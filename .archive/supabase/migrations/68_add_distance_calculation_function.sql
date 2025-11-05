-- Migration: Add distance calculation function for AED data
-- Purpose: Calculate distance between health center and AED devices
-- Date: 2025-10-16

-- Drop function if exists
DROP FUNCTION IF EXISTS calculate_distance_km(FLOAT, FLOAT, FLOAT, FLOAT);

-- Create distance calculation function using Haversine formula
-- Returns distance in kilometers between two GPS coordinates
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 FLOAT,
  lon1 FLOAT,
  lat2 FLOAT,
  lon2 FLOAT
) RETURNS FLOAT AS $$
DECLARE
  r FLOAT := 6371; -- Earth radius in km
  d_lat FLOAT;
  d_lon FLOAT;
  a FLOAT;
  c FLOAT;
BEGIN
  -- Return NULL if any coordinate is NULL or zero
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL OR
     lat1 = 0 OR lon1 = 0 OR lat2 = 0 OR lon2 = 0 THEN
    RETURN NULL;
  END IF;

  -- Convert degrees to radians
  d_lat := radians(lat2 - lat1);
  d_lon := radians(lon2 - lon1);

  -- Haversine formula
  a := sin(d_lat / 2) * sin(d_lat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(d_lon / 2) * sin(d_lon / 2);

  c := 2 * atan2(sqrt(a), sqrt(1 - a));

  -- Return distance in km, rounded to 1 decimal place
  RETURN round((r * c)::numeric, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment
COMMENT ON FUNCTION calculate_distance_km(FLOAT, FLOAT, FLOAT, FLOAT) IS
  'Calculate distance in kilometers between two GPS coordinates using Haversine formula';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_distance_km(FLOAT, FLOAT, FLOAT, FLOAT) TO authenticated;
