// Prefer using binding.gyp include_dirs and node-addon-api dependency so we can
// include the public header.
#include <napi.h>

#include <windows.h>
#include <mmdeviceapi.h>
#include <endpointvolume.h>
#include <comdef.h>
#include <string>
#include <mutex>

using namespace Napi;

// Centralized COM initialization helper (singleton). Ensures CoInitializeEx is called once
// and CoUninitialize is called at process shutdown.
class ComScope
{
public:
    static void Ensure()
    {
        static ComScope instance;
        (void)instance;
    }

private:
    ComScope()
    {
        CoInitializeEx(NULL, COINIT_MULTITHREADED);
    }
    ~ComScope()
    {
        CoUninitialize();
    }
};

static std::string HResultToString(HRESULT hr)
{
    // Use FormatMessageW to get the system message for the HRESULT and convert to UTF-8.
    LPWSTR msgBuf = nullptr;
    DWORD flags = FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS;
    DWORD len = FormatMessageW(flags, NULL, static_cast<DWORD>(hr), MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT), (LPWSTR)&msgBuf, 0, NULL);
    std::string out;
    if (len && msgBuf)
    {
        int outLen = WideCharToMultiByte(CP_UTF8, 0, msgBuf, -1, NULL, 0, NULL, NULL);
        if (outLen > 0)
        {
            out.resize(outLen - 1);
            WideCharToMultiByte(CP_UTF8, 0, msgBuf, -1, &out[0], outLen, NULL, NULL);
        }
        LocalFree(msgBuf);
        return out;
    }

    // Fallback: show hex HRESULT
    char buf[64];
    sprintf_s(buf, "HRESULT 0x%08X", static_cast<unsigned int>(hr));
    return std::string(buf);
}

// Helper: get default endpoint for given flow, activate IAudioEndpointVolume
static HRESULT GetEndpointVolume(EDataFlow flow, IAudioEndpointVolume **ppEndpoint)
{
    if (!ppEndpoint)
        return E_POINTER;
    *ppEndpoint = nullptr;

    ComScope::Ensure();

    IMMDeviceEnumerator *pEnumerator = nullptr;
    HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), NULL, CLSCTX_ALL, __uuidof(IMMDeviceEnumerator), (void **)&pEnumerator);
    if (FAILED(hr) || !pEnumerator)
    {
        return hr;
    }

    IMMDevice *pDevice = nullptr;
    hr = pEnumerator->GetDefaultAudioEndpoint(flow, eConsole, &pDevice);
    if (FAILED(hr) || !pDevice)
    {
        pEnumerator->Release();
        return hr;
    }

    hr = pDevice->Activate(__uuidof(IAudioEndpointVolume), CLSCTX_ALL, NULL, (void **)ppEndpoint);

    pDevice->Release();
    pEnumerator->Release();

    return hr;
}

static void SafeRelease(IUnknown *p)
{
    if (p)
        p->Release();
}

Value GetSpeakerVolume(const CallbackInfo &info)
{
    Env env = info.Env();
    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eRender, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get speaker endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return env.Null();
    }

    float level = 0.0f;
    hr = pVol->GetMasterVolumeLevelScalar(&level);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "GetMasterVolumeLevelScalar failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return env.Null();
    }

    int vol = static_cast<int>(std::round(level * 100.0f));
    return Number::New(env, vol);
}

void SetSpeakerVolume(const CallbackInfo &info)
{
    Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber())
    {
        TypeError::New(env, "Expected volume number").ThrowAsJavaScriptException();
        return;
    }
    int v = info[0].As<Number>().Int32Value();
    float scalar = std::max(0, std::min(100, v)) / 100.0f;

    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eRender, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get speaker endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }

    hr = pVol->SetMasterVolumeLevelScalar(scalar, NULL);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "SetMasterVolumeLevelScalar failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }
}

void MuteSpeaker(const CallbackInfo &info)
{
    Env env = info.Env();
    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eRender, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get speaker endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }

    hr = pVol->SetMute(TRUE, NULL);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "SetMute failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }
}

void UnmuteSpeaker(const CallbackInfo &info)
{
    Env env = info.Env();
    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eRender, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get speaker endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }

    hr = pVol->SetMute(FALSE, NULL);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "SetMute failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }
}

Value IsSpeakerMuted(const CallbackInfo &info)
{
    Env env = info.Env();
    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eRender, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get speaker endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return Boolean::New(env, false);
    }

    BOOL muted = FALSE;
    hr = pVol->GetMute(&muted);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "GetMute failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return Boolean::New(env, false);
    }

    return Boolean::New(env, muted == TRUE);
}

// Microphone (capture endpoint) implementations
Value GetMicVolume(const CallbackInfo &info)
{
    Env env = info.Env();
    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eCapture, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get mic endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return env.Null();
    }

    float level = 0.0f;
    hr = pVol->GetMasterVolumeLevelScalar(&level);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "GetMasterVolumeLevelScalar failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return env.Null();
    }

    int vol = static_cast<int>(std::round(level * 100.0f));
    return Number::New(env, vol);
}

void SetMicVolume(const CallbackInfo &info)
{
    Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber())
    {
        TypeError::New(env, "Expected volume number").ThrowAsJavaScriptException();
        return;
    }
    int v = info[0].As<Number>().Int32Value();
    float scalar = std::max(0, std::min(100, v)) / 100.0f;

    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eCapture, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get mic endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }

    hr = pVol->SetMasterVolumeLevelScalar(scalar, NULL);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "SetMasterVolumeLevelScalar failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }
}

void MuteMic(const CallbackInfo &info)
{
    Env env = info.Env();
    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eCapture, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get mic endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }

    hr = pVol->SetMute(TRUE, NULL);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "SetMute failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }
}

void UnmuteMic(const CallbackInfo &info)
{
    Env env = info.Env();
    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eCapture, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get mic endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }

    hr = pVol->SetMute(FALSE, NULL);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "SetMute failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return;
    }
}

Value IsMicMuted(const CallbackInfo &info)
{
    Env env = info.Env();
    IAudioEndpointVolume *pVol = nullptr;
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInited = SUCCEEDED(hr);

    hr = GetEndpointVolume(eCapture, &pVol);
    if (FAILED(hr) || !pVol)
    {
        if (coInited)
            CoUninitialize();
        Error::New(env, "Failed to get mic endpoint: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return Boolean::New(env, false);
    }

    BOOL muted = FALSE;
    hr = pVol->GetMute(&muted);
    pVol->Release();
    if (coInited)
        CoUninitialize();
    if (FAILED(hr))
    {
        Error::New(env, "GetMute failed: " + std::to_string(hr)).ThrowAsJavaScriptException();
        return Boolean::New(env, false);
    }

    return Boolean::New(env, muted == TRUE);
}

Object Init(Env env, Object exports)
{
    exports.Set("getSpeakerVolume", Function::New(env, GetSpeakerVolume));
    exports.Set("setSpeakerVolume", Function::New(env, SetSpeakerVolume));
    exports.Set("muteSpeaker", Function::New(env, MuteSpeaker));
    exports.Set("unmuteSpeaker", Function::New(env, UnmuteSpeaker));
    exports.Set("isSpeakerMuted", Function::New(env, IsSpeakerMuted));

    exports.Set("getMicVolume", Function::New(env, GetMicVolume));
    exports.Set("setMicVolume", Function::New(env, SetMicVolume));
    exports.Set("muteMic", Function::New(env, MuteMic));
    exports.Set("unmuteMic", Function::New(env, UnmuteMic));
    exports.Set("isMicMuted", Function::New(env, IsMicMuted));

    return exports;
}

NODE_API_MODULE(win_audio, Init)
