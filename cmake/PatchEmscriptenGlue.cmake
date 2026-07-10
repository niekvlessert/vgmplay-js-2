if(NOT DEFINED INPUT OR NOT EXISTS "${INPUT}")
  message(FATAL_ERROR "INPUT must name an existing Emscripten glue file")
endif()

file(READ "${INPUT}" GLUE)
set(UNSAFE "UTF8Decoder.decode(heapOrArray.subarray(idx,endPtr))")
set(SAFE "UTF8Decoder.decode(heapOrArray.slice(idx,endPtr))")

string(FIND "${GLUE}" "${UNSAFE}" UNSAFE_INDEX)
if(UNSAFE_INDEX EQUAL -1)
  message(STATUS "Emscripten TextDecoder compatibility patch not needed: ${INPUT}")
  return()
endif()

# Chrome rejects views backed by resizable WebAssembly memory in TextDecoder.
# TypedArray.slice creates a fixed ArrayBuffer snapshot for the decoder.
string(REPLACE "${UNSAFE}" "${SAFE}" GLUE "${GLUE}")
file(WRITE "${INPUT}" "${GLUE}")
message(STATUS "Patched Emscripten TextDecoder compatibility: ${INPUT}")
