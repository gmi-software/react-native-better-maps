package com.margelo.nitro.nitromaps

/** Growable list of unboxed ints for the marker index and cluster buckets. */
internal class IntList(initialCapacity: Int = 4) {
  private var values = IntArray(initialCapacity.coerceAtLeast(1))
  var size = 0
    private set

  operator fun get(index: Int): Int = values[index]

  fun add(value: Int) {
    if (size == values.size) {
      values = values.copyOf(values.size * 2)
    }
    values[size] = value
    size += 1
  }

  fun addAll(other: IntList) {
    val needed = size + other.size
    if (needed > values.size) {
      values = values.copyOf(maxOf(needed, values.size * 2))
    }
    System.arraycopy(other.values, 0, values, size, other.size)
    size = needed
  }

  /** Removes the first occurrence of [value] by swapping in the last element. */
  fun removeValue(value: Int): Boolean {
    for (index in 0 until size) {
      if (values[index] == value) {
        values[index] = values[size - 1]
        size -= 1
        return true
      }
    }
    return false
  }

  fun clear() {
    size = 0
  }

  fun isEmpty(): Boolean = size == 0

  fun toIntArray(): IntArray = values.copyOf(size)
}
