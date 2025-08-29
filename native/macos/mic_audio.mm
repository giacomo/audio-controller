// Objective-C++ CoreAudio-based mic control for macOS
// This file provides a minimal N-API wrapper for getting/setting input device volume and mute.
// It is a prototype and may require adjustments on different macOS versions.

#include <napi.h>
#include <CoreAudio/CoreAudio.h>
#include <AudioToolbox/AudioToolbox.h>
#include <cmath>
#include <string>

using namespace Napi;

static std::string HResultToString(OSStatus status) {
  char buf[64];
  sprintf(buf, "OSStatus 0x%08X", (unsigned int)status);
  return std::string(buf);
}

// Helper to get default input device
static AudioDeviceID GetDefaultInputDevice(OSStatus &outErr) {
  AudioDeviceID device = kAudioObjectUnknown;
  UInt32 size = sizeof(device);
  AudioObjectPropertyAddress addr = {
    kAudioHardwarePropertyDefaultInputDevice,
    kAudioObjectPropertyScopeGlobal,
    kAudioObjectPropertyElementMaster
  };
  outErr = AudioObjectGetPropertyData(kAudioObjectSystemObject, &addr, 0, NULL, &size, &device);
  return device;
}

static bool GetDeviceVolume(AudioDeviceID dev, Float32 &outVolume) {
  AudioObjectPropertyAddress addr = {
    kAudioDevicePropertyVolumeScalar,
    kAudioDevicePropertyScopeInput,
    1
  };
  UInt32 size = sizeof(Float32);
  OSStatus err = AudioObjectGetPropertyData(dev, &addr, 0, NULL, &size, &outVolume);
  return err == noErr;
}

static bool SetDeviceVolume(AudioDeviceID dev, Float32 vol) {
  AudioObjectPropertyAddress addr = {
    kAudioDevicePropertyVolumeScalar,
    kAudioDevicePropertyScopeInput,
    1
  };
  Float32 value = vol;
  OSStatus err = AudioObjectSetPropertyData(dev, &addr, 0, NULL, sizeof(value), &value);
  return err == noErr;
}

static bool GetDeviceMute(AudioDeviceID dev, UInt32 &outMuted) {
  AudioObjectPropertyAddress addr = {
    kAudioDevicePropertyMute,
    kAudioDevicePropertyScopeInput,
    kAudioObjectPropertyElementMaster
  };
  UInt32 size = sizeof(UInt32);
  OSStatus err = AudioObjectGetPropertyData(dev, &addr, 0, NULL, &size, &outMuted);
  return err == noErr;
}

Value GetMicVolume(const CallbackInfo &info) {
  Env env = info.Env();
  OSStatus err;
  AudioDeviceID dev = GetDefaultInputDevice(err);
  if (err != noErr) {
    Error::New(env, "Failed to get default input device: " + HResultToString(err)).ThrowAsJavaScriptException();
    return env.Null();
  }
  Float32 vol = 0.0f;
  if (!GetDeviceVolume(dev, vol)) {
    Error::New(env, "Failed to get device volume").ThrowAsJavaScriptException();
    return env.Null();
  }
  int iv = static_cast<int>(std::round(vol * 100.0f));
  return Number::New(env, iv);
}

void SetMicVolume(const CallbackInfo &info) {
  Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) {
    TypeError::New(env, "Expected volume number").ThrowAsJavaScriptException();
    return;
  }
  int v = info[0].As<Number>().Int32Value();
  Float32 scalar = std::max(0, std::min(100, v)) / 100.0f;
  OSStatus err;
  AudioDeviceID dev = GetDefaultInputDevice(err);
  if (err != noErr) {
    Error::New(env, "Failed to get default input device: " + HResultToString(err)).ThrowAsJavaScriptException();
    return;
  }
  if (!SetDeviceVolume(dev, scalar)) {
    Error::New(env, "Failed to set device volume").ThrowAsJavaScriptException();
    return;
  }
}

void MuteMic(const CallbackInfo &info) {
  Env env = info.Env();
  OSStatus err;
  AudioDeviceID dev = GetDefaultInputDevice(err);
  if (err != noErr) {
    Error::New(env, "Failed to get default input device: " + HResultToString(err)).ThrowAsJavaScriptException();
    return;
  }
  UInt32 mute = 1;
  AudioObjectPropertyAddress addr = { kAudioDevicePropertyMute, kAudioDevicePropertyScopeInput, kAudioObjectPropertyElementMaster };
  err = AudioObjectSetPropertyData(dev, &addr, 0, NULL, sizeof(mute), &mute);
  if (err != noErr) {
    Error::New(env, "Failed to mute device").ThrowAsJavaScriptException();
    return;
  }
}

void UnmuteMic(const CallbackInfo &info) {
  Env env = info.Env();
  OSStatus err;
  AudioDeviceID dev = GetDefaultInputDevice(err);
  if (err != noErr) {
    Error::New(env, "Failed to get default input device: " + HResultToString(err)).ThrowAsJavaScriptException();
    return;
  }
  UInt32 mute = 0;
  AudioObjectPropertyAddress addr = { kAudioDevicePropertyMute, kAudioDevicePropertyScopeInput, kAudioObjectPropertyElementMaster };
  err = AudioObjectSetPropertyData(dev, &addr, 0, NULL, sizeof(mute), &mute);
  if (err != noErr) {
    Error::New(env, "Failed to unmute device").ThrowAsJavaScriptException();
    return;
  }
}

Value IsMicMuted(const CallbackInfo &info) {
  Env env = info.Env();
  OSStatus err;
  AudioDeviceID dev = GetDefaultInputDevice(err);
  if (err != noErr) {
    Error::New(env, "Failed to get default input device: " + HResultToString(err)).ThrowAsJavaScriptException();
    return Boolean::New(env, false);
  }
  UInt32 muted = 0;
  if (!GetDeviceMute(dev, muted)) {
    Error::New(env, "Failed to get mute state").ThrowAsJavaScriptException();
    return Boolean::New(env, false);
  }
  return Boolean::New(env, muted != 0);
}

Object Init(Env env, Object exports) {
  exports.Set("getMicVolume", Function::New(env, GetMicVolume));
  exports.Set("setMicVolume", Function::New(env, SetMicVolume));
  exports.Set("muteMic", Function::New(env, MuteMic));
  exports.Set("unmuteMic", Function::New(env, UnmuteMic));
  exports.Set("isMicMuted", Function::New(env, IsMicMuted));
  return exports;
}

NODE_API_MODULE(mac_audio, Init)
