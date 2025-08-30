{
  "targets": [
    {
      "target_name": "mac_audio",
      "sources": [ "mac_audio.mm" ],
      "include_dirs": [ "<!(node -p \"require('node-addon-api').include_dir\")" ],
      "dependencies": [ "<!(node -p \"require('node-addon-api').gyp\")" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        [ "OS==\"mac\"", {
          "xcode_settings": {
            "OTHER_CPLUSPLUSFLAGS": ["-std=c++17"],
            "OTHER_LDFLAGS": ["-framework CoreAudio", "-framework AudioToolbox"]
          }
        }]
      ]
    }
  ]
}
