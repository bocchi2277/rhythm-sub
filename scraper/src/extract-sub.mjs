import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('extracted_subtitles');

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

// Recursively find all video files in a directory tree
function findAllVideoFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllVideoFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.mkv', '.mp4', '.avi', '.webm'].includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

// Normalize any input URL (Nyaa view URLs, Torrents, Magnets, Mega, Direct links)
function normalizeUrl(rawUrl) {
  let u = rawUrl.trim();

  // Nyaa view link: https://nyaa.si/view/2060249 -> https://nyaa.si/download/2060249.torrent
  const nyaaMatch = u.match(/^https?:\/\/(?:www\.)?nyaa\.si\/view\/(\d+)/i);
  if (nyaaMatch) {
    const converted = `https://nyaa.si/download/${nyaaMatch[1]}.torrent`;
    console.log(`🔄 Converted Nyaa view URL to torrent download URL: ${converted}`);
    return converted;
  }

  // Sukebei view link
  const sukebeiMatch = u.match(/^https?:\/\/(?:www\.)?sukebei\.nyaa\.si\/view\/(\d+)/i);
  if (sukebeiMatch) {
    const converted = `https://sukebei.nyaa.si/download/${sukebeiMatch[1]}.torrent`;
    console.log(`🔄 Converted Sukebei view URL to torrent download URL: ${converted}`);
    return converted;
  }

  return u;
}

function sanitizeFilename(name) {
  return name
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractSubtitles(rawUrl, outputName) {
  const inputUrl = normalizeUrl(rawUrl);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const workDir = path.resolve('temp_work');
  if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  const safeBundleName = sanitizeFilename(outputName || 'Subtitles_Batch');
  const targetSubDir = path.join(OUT_DIR, safeBundleName);
  if (fs.existsSync(targetSubDir)) fs.rmSync(targetSubDir, { recursive: true, force: true });
  fs.mkdirSync(targetSubDir, { recursive: true });
  const fontsDir = path.join(targetSubDir, 'fonts');
  fs.mkdirSync(fontsDir, { recursive: true });

  console.log(`\n======================================================`);
  console.log(`🎬 Target: ${safeBundleName}`);
  console.log(`🔗 Input URL: ${inputUrl}`);
  console.log(`======================================================\n`);

  // 1. Download source files
  if (inputUrl.startsWith('magnet:') || inputUrl.includes('.torrent') || inputUrl.includes('nyaa.si')) {
    console.log('📥 Downloading via BitTorrent (aria2c)...');
    const ariaArgs = [
      '--seed-time=0',
      '--summary-interval=10',
      '--file-allocation=none',
      '--bt-max-peers=128',
      '--bt-tracker-connect-timeout=10',
      '--bt-tracker-timeout=15',
      '--max-connection-per-server=16',
      '--split=16',
      `--dir="${workDir}"`,
      `"${inputUrl}"`
    ].join(' ');
    run(`aria2c ${ariaArgs}`);
  } else if (inputUrl.includes('mega.nz')) {
    console.log('📥 Downloading from MEGA...');
    try {
      run(`megatools dl --path "${workDir}" "${inputUrl}"`);
    } catch (e) {
      console.log('Megatools fallback: trying python mega-download...');
      run(`python3 -c "from mega import Mega; m = Mega(); m.login(); m.download_url('${inputUrl}', '${workDir}')"`);
    }
  } else if (inputUrl.startsWith('http')) {
    console.log('📥 Downloading direct URL via aria2c...');
    run(`aria2c --dir="${workDir}" --file-allocation=none --summary-interval=10 "${inputUrl}"`);
  } else {
    // Local path
    if (fs.existsSync(inputUrl)) {
      const dest = path.join(workDir, path.basename(inputUrl));
      fs.copyFileSync(inputUrl, dest);
    }
  }

  // 2. Discover all video files recursively
  const videoFiles = findAllVideoFiles(workDir);
  if (videoFiles.length === 0) {
    throw new Error('❌ No video files (.mkv / .mp4 / .avi / .webm) found in download.');
  }

  console.log(`\n📦 Discovered ${videoFiles.length} video file(s) in batch:`);
  for (let i = 0; i < videoFiles.length; i++) {
    const sizeMb = (fs.statSync(videoFiles[i]).size / (1024 * 1024)).toFixed(1);
    console.log(`   [${i + 1}/${videoFiles.length}] ${path.basename(videoFiles[i])} (${sizeMb} MB)`);
  }

  let totalSubsExtracted = 0;
  let totalFontsExtracted = 0;
  const seenFontNames = new Set();

  // 3. Process each video file and extract all subtitle tracks & fonts
  for (let idx = 0; idx < videoFiles.length; idx++) {
    const vFile = videoFiles[idx];
    const baseName = path.basename(vFile, path.extname(vFile));
    const cleanBaseName = sanitizeFilename(baseName);

    console.log(`\n------------------------------------------------------`);
    console.log(`⚡ Processing [${idx + 1}/${videoFiles.length}]: ${baseName}`);
    console.log(`------------------------------------------------------`);

    let mkvInfo = null;
    try {
      const infoRaw = spawnSync('mkvmerge', ['-J', vFile], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
      if (infoRaw.stdout) {
        mkvInfo = JSON.parse(infoRaw.stdout);
      }
    } catch {}

    if (mkvInfo && Array.isArray(mkvInfo.tracks)) {
      const subTracks = mkvInfo.tracks.filter((t) => t.type === 'subtitles');
      const attachments = (mkvInfo.attachments || []).filter((a) => /\.(ttf|otf|ttc|woff|woff2)$/i.test(a.file_name || ''));

      console.log(`   Found ${subTracks.length} subtitle track(s) and ${attachments.length} font attachment(s).`);

      // Extract subtitle tracks
      for (const trk of subTracks) {
        const codec = (trk.codec || '').toLowerCase();
        const ext = codec.includes('subrip') || codec.includes('srt') ? 'srt' : 'ass';
        const lang = trk.properties?.language || trk.properties?.language_ietf || 'und';
        const trackTitle = trk.properties?.track_name ? sanitizeFilename(trk.properties.track_name) : '';
        const isDefault = trk.properties?.default_track ? '_default' : '';
        const suffix = trackTitle ? `_[${lang}]_[${trackTitle}]` : `_[${lang}]_track${trk.id}${isDefault}`;
        const subOutFile = path.join(targetSubDir, `${cleanBaseName}${suffix}.${ext}`);

        console.log(`   📝 Extracting Track #${trk.id} (${lang}${trackTitle ? ` - ${trackTitle}` : ''}) -> ${path.basename(subOutFile)}`);
        try {
          run(`mkvextract tracks "${vFile}" ${trk.id}:"${subOutFile}"`);
          totalSubsExtracted++;
        } catch (e) {
          console.warn(`   ⚠️ mkvextract failed for track ${trk.id}, trying ffmpeg...`);
          try {
            run(`ffmpeg -y -i "${vFile}" -map 0:${trk.id} -c:s copy "${subOutFile}"`);
            totalSubsExtracted++;
          } catch (e2) {
            console.error(`   ❌ Failed to extract track #${trk.id}`);
          }
        }
      }

      // Extract fonts
      if (attachments.length > 0) {
        const toExtract = [];
        for (const att of attachments) {
          const fName = sanitizeFilename(att.file_name || `font_${att.id}.ttf`);
          if (!seenFontNames.has(fName.toLowerCase())) {
            seenFontNames.add(fName.toLowerCase());
            toExtract.push(`${att.id}:"${path.join(fontsDir, fName)}"`);
          }
        }
        if (toExtract.length > 0) {
          console.log(`   🔤 Extracting ${toExtract.length} new font(s) into fonts/`);
          try {
            run(`mkvextract attachments "${vFile}" ${toExtract.join(' ')}`);
            totalFontsExtracted += toExtract.length;
          } catch (e) {
            console.warn('   ⚠️ Font extraction skipped or partially failed:', e.message);
          }
        }
      }
    } else {
      // Fallback to ffmpeg for mp4/non-mkv files
      const fallbackAss = path.join(targetSubDir, `${cleanBaseName}.ass`);
      console.log(`   ⚡ Extracting with FFmpeg -> ${path.basename(fallbackAss)}`);
      try {
        run(`ffmpeg -y -i "${vFile}" -map 0:s:0 -c:s copy "${fallbackAss}"`);
        totalSubsExtracted++;
      } catch (e) {
        console.warn(`   ⚠️ No subtitles found or FFmpeg extraction failed for ${baseName}`);
      }
    }
  }

  // 4. Clean up fonts folder if empty
  try {
    if (fs.existsSync(fontsDir) && fs.readdirSync(fontsDir).length === 0) {
      fs.rmdirSync(fontsDir);
    }
  } catch {}

  // 5. Clean up temporary video files to free disk space immediately
  console.log('\n🧹 Cleaning up temporary video files from disk...');
  fs.rmSync(workDir, { recursive: true, force: true });

  // 6. Summary of results
  console.log(`\n======================================================`);
  console.log(`🎉 Extraction Summary for: ${safeBundleName}`);
  console.log(`   - Episodes Processed: ${videoFiles.length}`);
  console.log(`   - Subtitle Files Extracted: ${totalSubsExtracted}`);
  console.log(`   - Unique Fonts Extracted: ${totalFontsExtracted}`);
  console.log(`   📁 Output Folder: ${targetSubDir}`);
  console.log(`======================================================\n`);

  return { targetSubDir, totalSubs: totalSubsExtracted, totalFonts: totalFontsExtracted };
}

// Direct CLI Execution
if (process.argv[1]?.endsWith('extract-sub.mjs')) {
  const url = process.argv[2] || 'https://nyaa.si/download/2151962.torrent';
  const name = process.argv[3] || 'Subtitles_Batch';
  extractSubtitles(url, name).catch((e) => {
    console.error('Fatal Extraction Error:', e);
    process.exit(1);
  });
}
