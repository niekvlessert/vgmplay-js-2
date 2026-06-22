function(stage_web_assets target root_dir)
    if(ARGC GREATER 2)
        set(manifest_name "${ARGV2}")
    else()
        set(manifest_name "web-assets.txt")
    endif()
    set(manifest "${root_dir}/${manifest_name}")
    if(NOT EXISTS "${manifest}")
        message(FATAL_ERROR "Missing web asset manifest: ${manifest}")
    endif()

    file(STRINGS "${manifest}" web_asset_lines)
    foreach(asset_line ${web_asset_lines})
        string(REGEX REPLACE "#.*$" "" asset "${asset_line}")
        string(STRIP "${asset}" asset)
        if("${asset}" STREQUAL "")
            continue()
        endif()

        set(source "${root_dir}/${asset}")
        set(destination "$<TARGET_FILE_DIR:${target}>/${asset}")
        string(MAKE_C_IDENTIFIER "${manifest_name}_${asset}" asset_target_suffix)
        set(asset_target "${target}_stage_${asset_target_suffix}")
        if(IS_DIRECTORY "${source}")
            add_custom_target(${asset_target} ALL
                COMMAND ${CMAKE_COMMAND} -E rm -rf "${destination}"
                COMMAND ${CMAKE_COMMAND} -E copy_directory "${source}" "${destination}"
                COMMENT "Copying ${asset}"
            )
            add_dependencies(${asset_target} ${target})
        elseif(EXISTS "${source}")
            add_custom_target(${asset_target} ALL
                COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:${target}>"
                COMMAND ${CMAKE_COMMAND} -E copy_if_different "${source}" "${destination}"
                COMMENT "Copying ${asset}"
            )
            add_dependencies(${asset_target} ${target})
        else()
            message(STATUS "Optional web asset not found, skipping: ${asset}")
        endif()
    endforeach()
endfunction()
