{
  "targets": [
    {
      "target_name": "win_audio",
      "sources": [ "win_audio.cc" ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include_dir\")",
        "./node_modules/node-addon-api",
        "<(module_root_dir)/node_modules/node-addon-api"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS", "NOMINMAX", "_CRT_SECURE_NO_WARNINGS" ],
      "conditions": [
        [ "OS==\"win\"", {
          "defines": [ "_WIN32_WINNT=0x0A00" ],
          "link_settings": {
            "libraries": [ "ole32.lib" ]
          }
        } ],
        [ "OS!=\"win\"", {
          "defines": [ "_POSIX_C_SOURCE=200809L" ]
        } ]
      ]
    }
  ]
}
