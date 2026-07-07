function(read_web_asset_manifest root_dir manifest_name out_var)
    set(manifest "${root_dir}/${manifest_name}")
    if(NOT EXISTS "${manifest}")
        message(FATAL_ERROR "Missing web asset manifest: ${manifest}")
    endif()

    set(assets)
    file(STRINGS "${manifest}" web_asset_lines)
    foreach(asset_line ${web_asset_lines})
        string(REGEX REPLACE "#.*$" "" asset "${asset_line}")
        string(STRIP "${asset}" asset)
        if("${asset}" STREQUAL "")
            continue()
        endif()
        list(APPEND assets "${asset}")
    endforeach()

    set(${out_var} "${assets}" PARENT_SCOPE)
endfunction()

function(prune_web_assets target root_dir keep_manifest_name)
    read_web_asset_manifest("${root_dir}" "${keep_manifest_name}" keep_assets)

    set(remove_assets)
    foreach(manifest_name ${ARGN})
        read_web_asset_manifest("${root_dir}" "${manifest_name}" candidate_assets)
        foreach(asset ${candidate_assets})
            list(FIND keep_assets "${asset}" keep_index)
            if(keep_index EQUAL -1)
                list(APPEND remove_assets "${asset}")
            endif()
        endforeach()
    endforeach()

    if(remove_assets)
        list(REMOVE_DUPLICATES remove_assets)
    endif()

    set(prune_target "${target}_prune_web_assets")
    set(prune_commands
        COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:${target}>"
    )
    foreach(asset ${remove_assets})
        get_filename_component(asset_dir "${asset}" DIRECTORY)
        list(APPEND prune_commands
            COMMAND ${CMAKE_COMMAND}
                -DDESTINATION="$<TARGET_FILE_DIR:${target}>/${asset}"
                -DDESTINATION_PARENT="$<TARGET_FILE_DIR:${target}>/${asset_dir}"
                -P "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/PrepareWebAssetPrune.cmake"
            COMMAND ${CMAKE_COMMAND} -E rm -rf "$<TARGET_FILE_DIR:${target}>/${asset}"
        )
    endforeach()

    add_custom_target(${prune_target} ALL
        ${prune_commands}
        COMMENT "Pruning web assets not listed in ${keep_manifest_name}"
    )
    add_dependencies(${prune_target} ${target})
    set_property(GLOBAL PROPERTY "STAGE_WEB_ASSETS_PRUNE_TARGET_${target}" "${prune_target}")
endfunction()

function(stage_web_assets target root_dir)
    if(ARGC GREATER 2)
        set(manifest_name "${ARGV2}")
    else()
        set(manifest_name "web-assets.txt")
    endif()

    read_web_asset_manifest("${root_dir}" "${manifest_name}" web_assets)
    get_property(prune_target GLOBAL PROPERTY "STAGE_WEB_ASSETS_PRUNE_TARGET_${target}")

    foreach(asset ${web_assets})
        set(source "${root_dir}/${asset}")
        set(destination "$<TARGET_FILE_DIR:${target}>/${asset}")
        get_filename_component(asset_dir "${asset}" DIRECTORY)
        string(MAKE_C_IDENTIFIER "${manifest_name}_${asset}" asset_target_suffix)
        set(asset_target "${target}_stage_${asset_target_suffix}")
        if(IS_DIRECTORY "${source}")
            add_custom_target(${asset_target} ALL
                COMMAND ${CMAKE_COMMAND}
                    -DDESTINATION="${destination}"
                    -DDESTINATION_PARENT="$<TARGET_FILE_DIR:${target}>/${asset_dir}"
                    -P "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/PrepareWebAssetDestination.cmake"
                COMMAND ${CMAKE_COMMAND} -E copy_directory "${source}" "${destination}"
                COMMENT "Copying ${asset}"
            )
            add_dependencies(${asset_target} ${target})
            if(prune_target)
                add_dependencies(${asset_target} ${prune_target})
            endif()
        elseif(EXISTS "${source}")
            add_custom_target(${asset_target} ALL
                COMMAND ${CMAKE_COMMAND}
                    -DDESTINATION="${destination}"
                    -DDESTINATION_PARENT="$<TARGET_FILE_DIR:${target}>/${asset_dir}"
                    -P "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/PrepareWebAssetDestination.cmake"
                COMMAND ${CMAKE_COMMAND} -E copy_if_different "${source}" "${destination}"
                COMMENT "Copying ${asset}"
            )
            add_dependencies(${asset_target} ${target})
            if(prune_target)
                add_dependencies(${asset_target} ${prune_target})
            endif()
        else()
            message(STATUS "Optional web asset not found, skipping: ${asset}")
        endif()
    endforeach()
endfunction()
