# Embed hoot_remake's platform-neutral replay core without building its SDL,
# command-line, test, or install targets.  The private target names deliberately
# avoid collisions with libkss/libvgm targets already used by VGMPlay-JS.

set(HOOT_REMAKE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/modules/hoot_remake")

set(HOOT_REQUIRED_VENDOR_SOURCES
  third_party/libkss/modules/kmz80/kmz80.c
  third_party/libkss/modules/kmz80/kmz80c.c
  third_party/libkss/modules/kmz80/kmz80t.c
  third_party/libkss/modules/kmz80/kmevent.c
  third_party/libvgm/emu/cores/ay8910.c
  third_party/libvgm/emu/cores/fmopn.c
  third_party/libvgm/emu/cores/ym2151.c
  third_party/libvgm/emu/cores/nukedopm.c
  third_party/libvgm/emu/cores/ymdeltat.c
  third_party/libvgm/emu/cores/fmopl.c
  third_party/libvgm/emu/cores/ymf262.c
  third_party/libvgm/emu/logging.c
  third_party/px68k-libretro/m68000/musashi/m68kcpu.c
  third_party/px68k-libretro/m68000/musashi/m68kops.c
  third_party/px68k-libretro/m68000/musashi/softfloat/softfloat.c
)
foreach(source IN LISTS HOOT_REQUIRED_VENDOR_SOURCES)
  if(NOT EXISTS "${HOOT_REMAKE_DIR}/${source}")
    message(FATAL_ERROR
      "Missing hoot_remake dependency source: ${source}. "
      "Run 'bash modules/hoot_remake/tools/ci/fetch_dependencies.sh' before configuring.")
  endif()
endforeach()

add_library(vgmplay_hoot_kmz80 STATIC
  ${HOOT_REMAKE_DIR}/third_party/libkss/modules/kmz80/kmz80.c
  ${HOOT_REMAKE_DIR}/third_party/libkss/modules/kmz80/kmz80c.c
  ${HOOT_REMAKE_DIR}/third_party/libkss/modules/kmz80/kmz80t.c
  ${HOOT_REMAKE_DIR}/third_party/libkss/modules/kmz80/kmevent.c
)
target_include_directories(vgmplay_hoot_kmz80 PUBLIC
  ${HOOT_REMAKE_DIR}/third_party/libkss/modules/kmz80
)

add_library(vgmplay_hoot_libvgm STATIC
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu/cores/ay8910.c
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu/cores/fmopn.c
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu/cores/ym2151.c
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu/cores/nukedopm.c
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu/cores/ymdeltat.c
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu/cores/fmopl.c
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu/cores/ymf262.c
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu/logging.c
)
target_include_directories(vgmplay_hoot_libvgm PUBLIC
  ${HOOT_REMAKE_DIR}/third_party/libvgm
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu
  ${HOOT_REMAKE_DIR}/third_party/libvgm/emu/cores
)
target_compile_definitions(vgmplay_hoot_libvgm PUBLIC HAVE_STDINT_H SNDDEV_YM2608)

add_library(vgmplay_hoot_musashi STATIC
  ${HOOT_REMAKE_DIR}/third_party/px68k-libretro/m68000/musashi/m68kcpu.c
  ${HOOT_REMAKE_DIR}/third_party/px68k-libretro/m68000/musashi/m68kops.c
  ${HOOT_REMAKE_DIR}/third_party/px68k-libretro/m68000/musashi/softfloat/softfloat.c
)
target_include_directories(vgmplay_hoot_musashi PUBLIC
  ${HOOT_REMAKE_DIR}/third_party/px68k-libretro/m68000/musashi
  ${HOOT_REMAKE_DIR}/third_party/px68k-libretro/m68000/musashi/softfloat
)
target_compile_definitions(vgmplay_hoot_musashi PUBLIC HAVE_STDINT_H)

set(HOOT_CORE_SOURCES
  src/config/hoot_catalog.cpp
  src/config/hoot_catalog_loader.cpp
  src/config/hoot_json_loader.cpp
  src/config/hoot_sqlite_loader.cpp
  src/config/hoot_xml_loader.cpp
  src/core/hoot_context.cpp
  src/core/entry_validation.cpp
  src/core/text_encoding.cpp
  src/cpu/kmz80_cpu.cpp
  src/cpu/musashi_bus.cpp
  src/cpu/x86_cpu.cpp
  src/drivers/driver_registry.cpp
  src/drivers/konami_hornet_driver.cpp
  src/drivers/microcabin_pc88_driver.cpp
  src/drivers/pc88_generic_driver.cpp
  src/drivers/microcabin_pc98dos_driver.cpp
  src/drivers/pc98_dos_driver.cpp
  src/drivers/sharp_x1_generic_driver.cpp
  src/drivers/x68k_generic_driver.cpp
  src/drivers/x68k_mxdrv_driver.cpp
  src/io/d88_image.cpp
  src/io/filesystem_asset_provider.cpp
  src/io/memory_asset_provider.cpp
  src/io/zip_archive.cpp
  src/sound/libvgm_ym2151.cpp
  src/sound/libvgm_okim6258.cpp
  src/sound/libvgm_ym2203.cpp
  src/sound/libvgm_opl.cpp
  src/sound/libvgm_ym2608.cpp
  src/sound/k056800.cpp
  src/sound/rf5c400.cpp
  src/sound/pc98_pcm86.cpp
  src/sound/pc98_beep.cpp
  src/sound/pc98_mpu401.cpp
  src/sound/x68k_pcm8_mixer.cpp
  src/sound/x68k_midi_transport.cpp
  src/sound/fluidsynth_midi_synth.cpp
  src/sound/vermouth_midi_synth.cpp
  src/sound/cm32p_midi_synth.cpp
  src/sound/cm64_midi_synth.cpp
  src/sound/mt32emu_midi_synth.cpp
  src/sound/nuked_sc55_clap_midi_synth.cpp
)
list(TRANSFORM HOOT_CORE_SOURCES PREPEND "${HOOT_REMAKE_DIR}/")

add_library(vgmplay_hoot STATIC ${HOOT_CORE_SOURCES})
target_include_directories(vgmplay_hoot PUBLIC ${HOOT_REMAKE_DIR}/src)
target_compile_features(vgmplay_hoot PUBLIC cxx_std_17)
target_compile_definitions(vgmplay_hoot PUBLIC HOOT_STATIC PRIVATE HOOT_NO_ZSTD=1)
target_compile_options(vgmplay_hoot PRIVATE "--use-port=sqlite3")
target_link_options(vgmplay_hoot PUBLIC "--use-port=sqlite3")
target_link_libraries(vgmplay_hoot PUBLIC
  vgmplay_hoot_kmz80
  vgmplay_hoot_libvgm
  vgmplay_hoot_musashi
)

# The shipped catalogue is compressed for source control.  Expand it on the
# host and preload the immutable SQLite file into the Wasm filesystem.
find_program(HOOT_ZSTD_EXECUTABLE zstd REQUIRED)
set(HOOT_CATALOG_DIR "${CMAKE_CURRENT_BINARY_DIR}/hoot-catalog")
set(HOOT_CATALOG_SQLITE "${HOOT_CATALOG_DIR}/hoot.sqlite")
add_custom_command(
  OUTPUT "${HOOT_CATALOG_SQLITE}"
  COMMAND ${CMAKE_COMMAND} -E make_directory "${HOOT_CATALOG_DIR}"
  COMMAND "${HOOT_ZSTD_EXECUTABLE}" -d -f
    "${HOOT_REMAKE_DIR}/catalog/hoot.sqlite.zst"
    -o "${HOOT_CATALOG_SQLITE}"
  DEPENDS "${HOOT_REMAKE_DIR}/catalog/hoot.sqlite.zst"
  COMMENT "Preparing the Hoot archive catalogue"
  VERBATIM
)
add_custom_target(vgmplay_hoot_catalog DEPENDS "${HOOT_CATALOG_SQLITE}")
