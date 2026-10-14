package com.margelo.nitro.nitromaps

import android.content.res.Resources

internal fun ClusterElement.Cluster.accessibilityLabel(resources: Resources): String =
  resources.getQuantityString(R.plurals.better_maps_cluster_description, count, count)
