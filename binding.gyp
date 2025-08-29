
{
  "targets": [
    {
      "target_name": "win_audio",
      "conditions": [
        [ "OS==\"win\"", {
          "sources": [ "native/win-audio/win_audio.cc" ],
          "include_dirs": [
            "<!(node -p \"require('node-addon-api').include_dir\")"
          ],
          "dependencies": [
            "<!(node -p \"require('node-addon-api').gyp\")"
          ],
          "cflags_cc!": [ "-fno-exceptions" ],
          "defines": [
            "NAPI_DISABLE_CPP_EXCEPTIONS",
            "NOMINMAX",
            "_CRT_SECURE_NO_WARNINGS",
            "_WIN32_WINNT=0x0A00"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          },
          "link_settings": {
            "libraries": [ "ole32.lib" ]
          }
        }],
    [ "OS!=\"win\"", {
          # Provide a tiny stub source for non-Windows builds so gyp has a valid target
          "sources": [ "native/win-audio/empty.cpp" ],
          "defines": [ "_POSIX_C_SOURCE=200809L" ]
        }]
      ]
    }
  ]
}
