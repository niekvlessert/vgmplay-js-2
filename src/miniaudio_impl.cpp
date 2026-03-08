#define MA_NO_DEVICE_IO
#define MA_NO_THREADING
#define MA_NO_ENCODING
#define MA_NO_GENERATION

// Explicitly enable decoders just in case
#define MA_HAS_WAV
#define MA_HAS_FLAC
#define MA_HAS_MP3
#define MA_HAS_OGG

#define MINIAUDIO_IMPLEMENTATION
#include "../modules/miniaudio/miniaudio.h"
