/**
 * Geocode Existing Projects
 *
 * This script automatically fetches GPS coordinates for all projects
 * that don't have site_latitude/site_longitude set.
 *
 * REQUIRES:
 * - Google Geocoding API key (or Mapbox, Nominatim)
 * - Supabase credentials in .env
 *
 * USAGE:
 * node scripts/geocode-projects.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Geocode an address using Google Geocoding API
 * Get your API key: https://console.cloud.google.com/apis/credentials
 */
async function geocodeAddress(address) {
  const GOOGLE_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY;

  if (!GOOGLE_API_KEY) {
    console.warn('⚠️ GOOGLE_GEOCODING_API_KEY not set, using fallback method');
    return geocodeWithNominatim(address);
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formatted_address: data.results[0].formatted_address
      };
    } else {
      console.error(`Geocoding failed for "${address}": ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error geocoding "${address}":`, error.message);
    return null;
  }
}

/**
 * Free alternative: Nominatim (OpenStreetMap)
 * Rate limit: 1 request per second
 */
async function geocodeWithNominatim(address) {
  try {
    const fetch = (await import('node-fetch')).default;
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;

    // Nominatim requires User-Agent header
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HomeProHub/1.0 (contact@homeprohub.today)'
      }
    });

    const data = await response.json();

    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formatted_address: data[0].display_name
      };
    } else {
      console.error(`Nominatim geocoding failed for "${address}"`);
      return null;
    }
  } catch (error) {
    console.error(`Error geocoding with Nominatim "${address}":`, error.message);
    return null;
  }
}

/**
 * Main function
 */
async function geocodeAllProjects() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Geocoding Projects');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // Fetch all projects without GPS coordinates
  const { data: projects, error } = await supabase
    .from('job_postings')
    .select('id, title, address, location_zip, site_latitude, site_longitude')
    .or('site_latitude.is.null,site_longitude.is.null')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching projects:', error.message);
    return;
  }

  if (projects.length === 0) {
    console.log('✅ All projects already have GPS coordinates!');
    return;
  }

  console.log(`Found ${projects.length} projects without GPS coordinates\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];

    console.log(`[${i + 1}/${projects.length}] ${project.title}`);
    console.log(`  Address: ${project.address || 'N/A'}`);

    if (!project.address) {
      console.log(`  ⚠️ Skipping - no address set\n`);
      failCount++;
      continue;
    }

    // Geocode the address
    const coords = await geocodeAddress(project.address);

    if (coords) {
      // Update database
      const { error: updateError } = await supabase
        .from('job_postings')
        .update({
          site_latitude: coords.latitude,
          site_longitude: coords.longitude
        })
        .eq('id', project.id);

      if (updateError) {
        console.log(`  ❌ Database update failed: ${updateError.message}\n`);
        failCount++;
      } else {
        console.log(`  ✅ Updated: ${coords.latitude}, ${coords.longitude}`);
        console.log(`  Verified: ${coords.formatted_address}\n`);
        successCount++;
      }
    } else {
      console.log(`  ❌ Geocoding failed\n`);
      failCount++;
    }

    // Rate limiting: Wait 1 second between requests (for Nominatim)
    if (i < projects.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${projects.length}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

// Run script
if (require.main === module) {
  geocodeAllProjects()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Script error:', err);
      process.exit(1);
    });
}

module.exports = { geocodeAddress, geocodeWithNominatim };
