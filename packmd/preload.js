const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function isExternalUrl(p) {
  if (!p) return true;
  const lower = p.trim().toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('//')
  );
}

function normalizeFileUrl(p) {
  if (!p || !p.toLowerCase().startsWith('file://')) return p;
  const url = new URL(p);
  let pathname = url.pathname;
  pathname = decodeURIComponent(pathname);
  if (/^\/[a-zA-Z]:\//.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return pathname;
}

function extractPathFromMarkdown(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  const angleMatch = trimmed.match(/^<(.+)>$/);
  const body = angleMatch ? angleMatch[1] : trimmed;
  const pathOnlyMatch = body.match(/^(.+?)(\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*$/);
  const pathOnly = (pathOnlyMatch && pathOnlyMatch[1]) || body;
  return pathOnly.trim();
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function resolveImagePath(mdFileDir, rawPath) {
  if (!rawPath) return null;
  let p = extractPathFromMarkdown(rawPath);
  p = normalizeFileUrl(p);

  if (/^[a-zA-Z]:[\\/]/.test(p) || path.isAbsolute(p)) {
    return path.normalize(p);
  }
  return path.normalize(path.join(mdFileDir, p));
}

function hashFileSync(filePath) {
  const hash = crypto.createHash('sha1');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function nowTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function randomUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function copyWithDedup(
  srcPath,
  assetsDir,
  assetsRelative,
  existingByHash,
  nameConflictCount,
  getNameParts
) {
  if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
    throw new Error('图片文件不存在或不是普通文件: ' + srcPath);
  }
  const hash = hashFileSync(srcPath);
  if (existingByHash[hash]) {
    return {
      targetRelative: existingByHash[hash].relative,
      reused: true
    };
  }

  ensureDirSync(assetsDir);

  const { baseName, ext } = getNameParts
    ? getNameParts(srcPath)
    : (function fallback() {
        const bn = path.basename(srcPath);
        const e = path.extname(bn);
        return { baseName: bn.slice(0, bn.length - e.length), ext: e };
      })();

  let targetName = `${baseName}${ext}`;
  let targetFullPath = path.join(assetsDir, targetName);
  let index = 1;

  while (fs.existsSync(targetFullPath)) {
    const existingHash = hashFileSync(targetFullPath);
    if (existingHash === hash) {
      const relative = assetsRelative === '.'
        ? targetName
        : toPosix(path.join(assetsRelative, targetName));
      existingByHash[hash] = {
        absolute: targetFullPath,
        relative
      };
      return {
        targetRelative: existingByHash[hash].relative,
        reused: true
      };
    }
    targetName = `${baseName}_${index}${ext}`;
    index += 1;
    targetFullPath = path.join(assetsDir, targetName);
  }

  fs.copyFileSync(srcPath, targetFullPath);
  const relative = assetsRelative === '.'
    ? targetName
    : toPosix(path.join(assetsRelative, targetName));
  existingByHash[hash] = {
    absolute: targetFullPath,
    relative
  };
  nameConflictCount.count += index - 1;
  return { targetRelative: relative, reused: false };
}

function backupMarkdownFile(filePath) {
  const backupPath = filePath + '.copy';
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function isWithinDir(targetPath, baseDir) {
  if (!targetPath || !baseDir) return false;
  const rel = path.relative(baseDir, targetPath);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function processSingleMarkdownFile(filePath, options, sharedHashByDir) {
  const {
    assetsDirName = 'assets',
    backupEnabled = false,
    namingMode = 'original',
    namingPrefix = 'img',
    namingStart = 1,
    deleteOld = false,
    logs = []
  } = options || {};

  const result = {
    filePath,
    imagesFound: 0,
    copied: 0,
    reused: 0,
    skippedExternal: 0,
    skippedMissing: 0,
    errors: [],
    nameConflicts: 0
  };

  const mdDir = path.dirname(filePath);
  const assetsDir = path.join(mdDir, assetsDirName);
  const assetsRelative = path.relative(mdDir, assetsDir) || '.';
  const nameConflictCount = { count: 0 };
  const existingByHash = sharedHashByDir
    ? (sharedHashByDir[assetsDir] = sharedHashByDir[assetsDir] || {})
    : {};
  const startNo = Number.isFinite(Number(namingStart)) ? Number(namingStart) : 1;
  const counter = { value: startNo };

  function getNameParts(srcPath) {
    const ext = path.extname(srcPath);
    const srcBase = path.basename(srcPath, ext);
    switch (namingMode) {
      case 'sequence': {
        const no = counter.value++;
        // 纯序号命名，不使用前缀配置
        return { baseName: `img-${no}`, ext };
      }
      case 'prefix': {
        const no = counter.value++;
        return { baseName: `${namingPrefix || 'img'}${no}`, ext };
      }
      case 'hash': {
        return { baseName: hashFileSync(srcPath), ext };
      }
      case 'date': {
        const no = counter.value++;
        // 日期时间命名，不使用前缀配置
        return { baseName: `img_${nowTimestamp()}_${no}`, ext };
      }
      case 'uuid': {
        return { baseName: randomUUID(), ext };
      }
      case 'fixed': {
        const base = namingPrefix || srcBase || 'image';
        return { baseName: base, ext };
      }
      case 'original':
      default:
        return { baseName: srcBase, ext };
    }
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    result.errors.push('读取文件失败: ' + e.message);
    return result;
  }

  if (backupEnabled) {
    try {
      backupMarkdownFile(filePath);
    } catch (e) {
      result.errors.push('备份失败: ' + e.message);
    }
  }

  const referenceDefs = {};
  const refDefRegex = /^\s*\[([^\]]+)\]:\s*(.+)$/gm;
  let refMatch;
  while ((refMatch = refDefRegex.exec(content)) !== null) {
    const id = refMatch[1];
    const p = refMatch[2];
    referenceDefs[id] = extractPathFromMarkdown(p);
  }

  function handleImagePath(rawPath) {
    result.imagesFound++;
    if (!rawPath) return { ok: false, reason: '空路径' };
    if (isExternalUrl(rawPath)) {
      result.skippedExternal++;
      return { ok: false, reason: '外部 URL' };
    }
    const absolute = resolveImagePath(mdDir, rawPath);
    if (!absolute || !fs.existsSync(absolute)) {
      result.skippedMissing++;
      return { ok: false, reason: '文件不存在: ' + rawPath };
    }
    try {
      const { targetRelative, reused } = copyWithDedup(
        absolute,
        assetsDir,
        assetsRelative,
        existingByHash,
        nameConflictCount,
        getNameParts
      );
       if (reused) {
         result.reused++;
       } else {
         result.copied++;
         if (deleteOld) {
           try {
             const isInAssets = isWithinDir(absolute, assetsDir);
             const isInMdDir = isWithinDir(absolute, mdDir);
             if (isInMdDir && !isInAssets) {
               fs.unlinkSync(absolute);
             }
           } catch (e) {
             result.errors.push('删除旧文件失败: ' + e.message);
           }
         }
       }
      return { ok: true, newPath: targetRelative };
    } catch (err) {
      result.errors.push('复制失败 ' + rawPath + ' : ' + err.message);
      return { ok: false, reason: '复制失败' };
    }
  }

  const inlineImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  content = content.replace(inlineImgRegex, (m, alt, raw) => {
    const handled = handleImagePath(raw);
    if (!handled.ok || !handled.newPath) {
      return m;
    }
    return m.replace(raw, handled.newPath);
  });

  const refImgRegex = /!\[([^\]]*)\]\[([^\]]+)\]/g;
  content = content.replace(refImgRegex, (m, alt, id) => {
    const rawPath = referenceDefs[id];
    if (!rawPath) return m;
    const handled = handleImagePath(rawPath);
    if (!handled.ok || !handled.newPath) {
      return m;
    }
    referenceDefs[id] = handled.newPath;
    return m;
  });

  const htmlImgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  content = content.replace(htmlImgRegex, (m, src) => {
    const handled = handleImagePath(src);
    if (!handled.ok || !handled.newPath) {
      return m;
    }
    return m.replace(src, handled.newPath);
  });

  refDefRegex.lastIndex = 0;
  content = content.replace(refDefRegex, (m, id, p) => {
    const newPath = referenceDefs[id];
    if (!newPath || extractPathFromMarkdown(p) === newPath) {
      return m;
    }
    return m.replace(p, newPath);
  });

  result.nameConflicts = nameConflictCount.count;

  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (e) {
    result.errors.push('写入文件失败: ' + e.message);
  }

  return result;
}

function walkMarkdownFilesInDir(dir) {
  const result = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const stats = fs.statSync(cur);
    if (stats.isDirectory()) {
      const entries = fs.readdirSync(cur);
      for (const name of entries) {
        const full = path.join(cur, name);
        stack.push(full);
      }
    } else if (stats.isFile() && cur.toLowerCase().endsWith('.md')) {
      result.push(cur);
    }
  }
  return result;
}

function processTargetPath(targetPath, options, sharedHashByDir) {
  let stats;
  try {
    stats = fs.statSync(targetPath);
  } catch (err) {
    return {
      summary: null,
      files: [
        {
          filePath: targetPath,
          imagesFound: 0,
          copied: 0,
          reused: 0,
          skippedExternal: 0,
          skippedMissing: 0,
          nameConflicts: 0,
          errors: ['无法读取路径: ' + err.message]
        }
      ]
    };
  }
  let files;
  if (stats.isDirectory()) {
    files = walkMarkdownFilesInDir(targetPath);
  } else {
    if (!targetPath.toLowerCase().endsWith('.md')) {
      return { summary: null, files: [] };
    }
    files = [targetPath];
  }

  const fileResults = [];
  const summary = {
    totalFiles: files.length,
    totalImagesFound: 0,
    totalCopied: 0,
    totalReused: 0,
    totalSkippedExternal: 0,
    totalSkippedMissing: 0,
    totalErrors: 0,
    totalNameConflicts: 0
  };

  for (const f of files) {
    try {
      const r = processSingleMarkdownFile(f, options, sharedHashByDir);
      fileResults.push(r);
      summary.totalImagesFound += r.imagesFound;
      summary.totalCopied += r.copied;
      summary.totalReused += r.reused;
      summary.totalSkippedExternal += r.skippedExternal;
      summary.totalSkippedMissing += r.skippedMissing;
      summary.totalNameConflicts += r.nameConflicts;
      summary.totalErrors += r.errors.length;
    } catch (e) {
      fileResults.push({
        filePath: f,
        imagesFound: 0,
        copied: 0,
        reused: 0,
        skippedExternal: 0,
        skippedMissing: 0,
        nameConflicts: 0,
        errors: ['处理异常: ' + e.message]
      });
      summary.totalErrors += 1;
    }
  }

  return { summary, files: fileResults };
}

function processTargets(targetPaths, options) {
  const allFiles = [];
  const globalSummary = {
    totalFiles: 0,
    totalImagesFound: 0,
    totalCopied: 0,
    totalReused: 0,
    totalSkippedExternal: 0,
    totalSkippedMissing: 0,
    totalErrors: 0,
    totalNameConflicts: 0
  };

  const logs = [];

  (targetPaths || []).forEach((p) => {
    try {
      if (!fs.existsSync(p)) {
        allFiles.push({
          filePath: p,
          imagesFound: 0,
          copied: 0,
          reused: 0,
          skippedExternal: 0,
          skippedMissing: 0,
          nameConflicts: 0,
          errors: ['路径不存在或不可访问']
        });
        globalSummary.totalErrors += 1;
        return;
      }
      const sharedHashByDir = {};
      const { summary, files } = processTargetPath(
        p,
        { ...options, logs },
        sharedHashByDir
      );
      if (!summary) {
        if (files && files.length) {
          allFiles.push(...files);
          files.forEach((f) => {
            globalSummary.totalErrors += (f.errors || []).length || 1;
          });
        }
        return;
      }
      globalSummary.totalFiles += summary.totalFiles;
      globalSummary.totalImagesFound += summary.totalImagesFound;
      globalSummary.totalCopied += summary.totalCopied;
      globalSummary.totalReused += summary.totalReused;
      globalSummary.totalSkippedExternal += summary.totalSkippedExternal;
      globalSummary.totalSkippedMissing += summary.totalSkippedMissing;
      globalSummary.totalErrors += summary.totalErrors;
      globalSummary.totalNameConflicts += summary.totalNameConflicts;
      allFiles.push(...files);
    } catch (e) {
      allFiles.push({
        filePath: p,
        imagesFound: 0,
        copied: 0,
        reused: 0,
        skippedExternal: 0,
        skippedMissing: 0,
        nameConflicts: 0,
        errors: ['处理目标异常: ' + e.message]
      });
      globalSummary.totalErrors += 1;
    }
  });

  return { summary: globalSummary, files: allFiles, logs };
}

function processTargetsAsync(targetPaths, options, onProgress, cancelToken) {
  return new Promise((resolve) => {
    const list = targetPaths.slice();
    const total = list.length || 0;
    let done = 0;
    const logs = [];
    const allFiles = [];
    const globalSummary = {
      totalFiles: 0,
      totalImagesFound: 0,
      totalCopied: 0,
      totalReused: 0,
      totalSkippedExternal: 0,
      totalSkippedMissing: 0,
      totalErrors: 0,
      totalNameConflicts: 0
    };

    function step() {
      if (cancelToken && cancelToken.cancelled) {
        return resolve({ summary: globalSummary, files: allFiles, logs, cancelled: true });
      }
      const p = list.shift();
      if (!p) {
        onProgress && onProgress({ done, total });
        return resolve({ summary: globalSummary, files: allFiles, logs });
      }
      try {
        const sharedHashByDir = {};
        const { summary, files } = processTargetPath(
          p,
          { ...options, logs },
          sharedHashByDir
        );
        if (summary) {
          globalSummary.totalFiles += summary.totalFiles;
          globalSummary.totalImagesFound += summary.totalImagesFound;
          globalSummary.totalCopied += summary.totalCopied;
          globalSummary.totalReused += summary.totalReused;
          globalSummary.totalSkippedExternal += summary.totalSkippedExternal;
          globalSummary.totalSkippedMissing += summary.totalSkippedMissing;
          globalSummary.totalErrors += summary.totalErrors;
          globalSummary.totalNameConflicts += summary.totalNameConflicts;
          allFiles.push(...files);
        } else if (files && files.length) {
          allFiles.push(...files);
          files.forEach((f) => {
            globalSummary.totalErrors += (f.errors || []).length || 1;
          });
        }
      } catch (err) {
        allFiles.push({
          filePath: p,
          imagesFound: 0,
          copied: 0,
          reused: 0,
          skippedExternal: 0,
          skippedMissing: 0,
          nameConflicts: 0,
          errors: ['处理目标异常: ' + err.message]
        });
        globalSummary.totalErrors += 1;
      } finally {
        done += 1;
        onProgress && onProgress({ done, total });
        setTimeout(step, 0);
      }
    }

    step();
  });
}

window.exports = {
  packmd: {
    mode: 'none',
    args: {
      enter: (action) => {
        window.postMessage({
          type: 'packmd-enter',
          payload: action
        });
      }
    }
  }
};

window.PackMD = {
  selectTargets: async function (mode = 'both') {
    const propsByMode = {
      files: ['openFile', 'multiSelections'],
      folders: ['openDirectory', 'multiSelections'],
      both: ['openFile', 'openDirectory', 'multiSelections']
    };
    const properties = propsByMode[mode] || propsByMode.both;
    const res = await utools.showOpenDialog({
      title: '选择 Markdown 文件或文件夹（可多选）',
      properties,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    });
    if (res && res.length > 0) {
      return res;
    }
    return [];
  },
  runPack: function (targetPaths, options) {
    const list = Array.isArray(targetPaths) ? targetPaths : [targetPaths];
    const filtered = (list || []).filter(Boolean);
    if (!filtered.length) {
      throw new Error('未选择任何目标');
    }
    return processTargets(filtered, options || {});
  },
  runPackAsync: function (targetPaths, options, onProgress, cancelToken) {
    const list = Array.isArray(targetPaths) ? targetPaths : [targetPaths];
    const filtered = (list || []).filter(Boolean);
    if (!filtered.length) {
      throw new Error('未选择任何目标');
    }
    return processTargetsAsync(filtered, options || {}, onProgress, cancelToken);
  },
  exportLog: function (logs) {
    if (!Array.isArray(logs) || !logs.length) return false;
    const savePath = utools.showSaveDialog({
      title: '导出日志',
      defaultPath: `packmd-log-${nowTimestamp()}.txt`
    });
    if (!savePath) return false;
    fs.writeFileSync(savePath, logs.join('\n'), 'utf8');
    return true;
  }
};
