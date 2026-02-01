'use strict';

const { query, transaction, getDb } = require('./sqlite-client');

/**
 * Get all dimensions with counts.
 */
function getDimensions() {
  const sql = `
    WITH dimension_counts AS (
      SELECT nd.dimension, COUNT(*) AS count
      FROM node_dimensions nd
      GROUP BY nd.dimension
    )
    SELECT
      d.name AS dimension,
      d.description,
      d.is_priority AS isPriority,
      COALESCE(dc.count, 0) AS count
    FROM dimensions d
    LEFT JOIN dimension_counts dc ON dc.dimension = d.name
    ORDER BY d.is_priority DESC, d.name ASC
  `;

  const rows = query(sql);

  return rows.map(row => ({
    dimension: row.dimension,
    description: row.description,
    isPriority: Boolean(row.isPriority),
    count: Number(row.count)
  }));
}

/**
 * Create or update a dimension.
 */
function createDimension(data) {
  const { name, description, isPriority = false } = data;
  const db = getDb();

  if (!name || !name.trim()) {
    throw new Error('Dimension name is required');
  }

  const trimmedName = name.trim();

  const stmt = db.prepare(`
    INSERT INTO dimensions(name, description, is_priority, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(name) DO UPDATE SET
      description = COALESCE(?, description),
      is_priority = COALESCE(?, is_priority),
      updated_at = CURRENT_TIMESTAMP
    RETURNING name, description, is_priority
  `);

  const rows = stmt.all(
    trimmedName,
    description ?? null,
    isPriority ? 1 : 0,
    description ?? null,
    isPriority ? 1 : 0
  );

  if (rows.length === 0) {
    throw new Error('Failed to create dimension');
  }

  return {
    dimension: rows[0].name,
    description: rows[0].description,
    isPriority: Boolean(rows[0].is_priority)
  };
}

/**
 * Update a dimension.
 */
function updateDimension(data) {
  const { name, currentName, newName, description, isPriority } = data;
  const db = getDb();

  // Handle rename
  if (currentName && newName && currentName !== newName) {
    // Check if new name already exists
    const existing = query('SELECT name FROM dimensions WHERE name = ?', [newName]);
    if (existing.length > 0) {
      throw new Error('A dimension with this name already exists');
    }

    transaction(() => {
      // Update dimensions table
      const dimStmt = db.prepare(`
        UPDATE dimensions
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `);
      const dimResult = dimStmt.run(newName, currentName);

      if (dimResult.changes === 0) {
        throw new Error('Dimension not found');
      }

      // Update node_dimensions
      const nodeDimStmt = db.prepare(`
        UPDATE node_dimensions
        SET dimension = ?
        WHERE dimension = ?
      `);
      nodeDimStmt.run(newName, currentName);
    });

    return {
      dimension: newName,
      previousName: currentName,
      renamed: true
    };
  }

  // Handle update (description/isPriority)
  const targetName = name || currentName;
  if (!targetName) {
    throw new Error('Dimension name is required');
  }

  const updates = [];
  const params = [];

  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }

  if (isPriority !== undefined) {
    updates.push('is_priority = ?');
    params.push(isPriority ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new Error('At least one update field must be provided');
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(targetName);

  const stmt = db.prepare(`
    UPDATE dimensions
    SET ${updates.join(', ')}
    WHERE name = ?
  `);

  const result = stmt.run(...params);

  if (result.changes === 0) {
    throw new Error('Dimension not found');
  }

  return {
    dimension: targetName,
    description,
    isPriority
  };
}

/**
 * Delete a dimension.
 */
function deleteDimension(name) {
  const db = getDb();

  if (!name || !name.trim()) {
    throw new Error('Dimension name is required');
  }

  const removal = transaction(() => {
    const nodeDimStmt = db.prepare('DELETE FROM node_dimensions WHERE dimension = ?');
    const dimStmt = db.prepare('DELETE FROM dimensions WHERE name = ?');

    const removedLinks = nodeDimStmt.run(name).changes ?? 0;
    const removedRow = dimStmt.run(name).changes ?? 0;

    return { removedLinks, removedRow };
  });

  if (!removal.removedLinks && !removal.removedRow) {
    throw new Error('Dimension not found');
  }

  return {
    dimension: name,
    deleted: true,
    removedLinks: removal.removedLinks
  };
}

module.exports = {
  getDimensions,
  createDimension,
  updateDimension,
  deleteDimension
};
