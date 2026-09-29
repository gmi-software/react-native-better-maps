#include "MarkerProjectionRegistry.hpp"

#include <mutex>
#include <unordered_map>

namespace margelo::nitro::nitromaps {
namespace {
std::mutex projectionMutex;
std::unordered_map<int, facebook::react::Point> projections;
}

void publishMarkerProjection(int tag, float x, float y) {
  if (tag <= 0) return;
  std::lock_guard lock(projectionMutex);
  projections[tag] = {.x = x, .y = y};
}

void clearMarkerProjection(int tag) {
  if (tag <= 0) return;
  std::lock_guard lock(projectionMutex);
  projections.erase(tag);
}

facebook::react::Point markerProjection(int tag) {
  std::lock_guard lock(projectionMutex);
  auto it = projections.find(tag);
  return it == projections.end() ? facebook::react::Point{} : it->second;
}
} // namespace margelo::nitro::nitromaps

extern "C" void NitroMapsPublishMarkerProjection(int tag, float x, float y) {
  margelo::nitro::nitromaps::publishMarkerProjection(tag, x, y);
}

extern "C" void NitroMapsClearMarkerProjection(int tag) {
  margelo::nitro::nitromaps::clearMarkerProjection(tag);
}
