package com.margelo.nitro.nitromaps

import android.content.res.Resources

/**
 * TalkBack label for a cluster. The badge may abbreviate the count. This uses
 * the exact member count.
 *
 * The label is the marker title. play-services-maps 19.0.0 has
 * `MarkerOptions.contentDescription`, but a live marker can change its
 * accessibility text only through `Marker.setTitle`. Maps copies that title
 * into the accessibility node's content description, including when the count
 * changes on the retained-cluster path.
 */
internal fun ClusterElement.Cluster.accessibilityLabel(resources: Resources): String =
  resources.getQuantityString(R.plurals.better_maps_cluster_description, count, count)
