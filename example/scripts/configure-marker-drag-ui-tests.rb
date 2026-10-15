#!/usr/bin/env ruby
require 'pathname'
require 'xcodeproj'

project_path = File.expand_path(ARGV.fetch(0))
repo_root = File.expand_path('../..', __dir__)
source_path = File.join(repo_root, 'example/ios-ui-tests/MarkerDragUITests.swift')
target_name = 'NitroMapsExampleUITests'

abort "Project not found: #{project_path}" unless File.directory?(project_path)
abort "UI test source not found: #{source_path}" unless File.file?(source_path)

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find do |target|
  target.name == 'NitroMapsExample' && target.product_type == 'com.apple.product-type.application'
end
abort 'NitroMapsExample application target was not found in the generated Expo project.' unless app_target

test_target = project.targets.find { |target| target.name == target_name }
unless test_target
  deployment_target = app_target.deployment_target || '16.0'
  test_target = project.new_target(:ui_test_bundle, target_name, :ios, deployment_target, nil, :swift)
  test_target.add_dependency(app_target)
end

project.root_object.attributes['TargetAttributes'] ||= {}
project.root_object.attributes['TargetAttributes'][test_target.uuid] ||= {}
project.root_object.attributes['TargetAttributes'][test_target.uuid]['TestTargetID'] = app_target.uuid

relative_source_path = Pathname.new(source_path).relative_path_from(Pathname.new(File.dirname(project_path))).to_s
source_reference = test_target.source_build_phase.files_references.find do |reference|
  File.basename(reference.path.to_s) == File.basename(source_path)
end
unless source_reference
  source_reference = project.main_group.new_file(relative_source_path)
  test_target.add_file_references([source_reference])
end

unless test_target.frameworks_build_phase.files_references.any? { |reference| reference.path.to_s.include?('XCTest.framework') }
  frameworks = project.frameworks_group
  xctest_path = 'Platforms/iPhoneSimulator.platform/Developer/Library/Frameworks/XCTest.framework'
  xctest = frameworks.children.find { |reference| reference.path.to_s == xctest_path } || frameworks.new_file(xctest_path, :developer_dir)
  test_target.frameworks_build_phase.add_file_reference(xctest)
end

test_target.build_configurations.each do |configuration|
  settings = configuration.build_settings
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.nitromaps.example.uitests'
  settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  settings['SWIFT_VERSION'] = '5.0'
  settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_target.deployment_target || '16.0'
  settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  settings['CODE_SIGNING_ALLOWED'] = 'NO'
  settings['TEST_TARGET_NAME'] = app_target.name
end

scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(app_target, test_target, launch_target: true)
scheme.save_as(project.path, app_target.name, true)
project.save
puts "Configured #{target_name} in #{project_path}"
