This directory contains generated C include fragments required by libsidplayfp.

The files are built from libsidplayfp's `*.a65` sources with `xa65` and then
included by `psiddrv.cpp` / `sidtune/MUS.cpp` at compile time. They are checked
in so the wasm/native CMake builds do not need the 6502 assembler toolchain
available during CI configure.
