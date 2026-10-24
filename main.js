/* Auto Pages - rule-driven auto page creation (CJS, Obsidian 1.x plugin format). */
const { Plugin, PluginSettingTab, Setting, normalizePath } = require("obsidian");

const INVALID_CHARS = /[*"\\/:<>|?]/;

function defaultSettings() {
  return {
    rules: [
      { id: 'r1', name: 'topic', enabled: true, watchFolders: ['00-inbox', 'Clippings'], property: 'topic', targetFolder: '10-topics', filePattern: '<value>.md', template: '90-templates/topic-template.md' }
    ],
    intervalMs: 5000,
    deleteOrphanPages: false,
    logToVault: false,
    logPath: 'autopage-log.md'
  };
}

function escapeRe(s) {
  let out = String(s);
  const specials = String.fromCharCode(42, 34, 92, 47, 62, 60, 58, 124, 63, 94, 36, 123, 125, 40, 41, 91, 93);
  for (let i = 0; i < specials.length; i++) { out = out.split(specials[i]).join(String.fromCharCode(92) + specials[i]); }
  return out;
}

function unquote(s) {
  s = String(s || '').trim();
  if (s.length >= 2) {
    const a = s[0], b = s[s.length - 1];
    if ((a === String.fromCharCode(39) || a === String.fromCharCode(34)) && a === b) { s = s.slice(1, -1).trim(); }
  }
  return s;
}

function propertyValues(text, prop) {
  if (!text || typeof text !== 'string' || !prop) return [];
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return [];
  const lines = m[1].split(/\r?\n/);
  const keyRe = new RegExp('^[ \\t]*' + escapeRe(prop) + ':[ \\t]*(.*)$');
  const listRe = new RegExp('^[ \\t]+-[ \\t]*(.+?)[ \\t]*$');
  for (let i = 0; i < lines.length; i++) {
    const km = lines[i].match(keyRe);
    if (!km) continue;
    const inline = unquote(km[1]);
    if (inline) return [inline];
    const out = [];
    for (let j = i + 1; j < lines.length; j++) {
      const it = lines[j].match(listRe);
      if (it) { out.push(unquote(it[1])); } else { break; }
    }
    return out;
  }
  return [];
}

class AutoPagesPlugin extends Plugin {
  constructor(app, manifest) {
    super(app, manifest);
    this.settings = defaultSettings();
    this.known = {};
    this.tickCount = 0;
  }

  async onload() {
    const loaded = await this.loadData();
    this.settings = Object.assign(defaultSettings(), loaded || {});
    if (!Array.isArray(this.settings.rules) || this.settings.rules.length === 0) { this.settings.rules = defaultSettings().rules; }
    this.takeSnapshot();
    this.startTimer();
    this.settingTabInstance = new AutoPagesSettingTab(this.app, this);
    this.addSettingTab(this.settingTabInstance);
    console.info('auto-pages: loaded, ' + this.settings.rules.length + ' rule(s), settings tab registered');
  }

  onunload() { window.clearInterval(this.timer); }

  startTimer() {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(function () { this.tick(); }.bind(this), Math.max(1000, this.settings.intervalMs || 5000));
  }

  notesIn(rule) {
    const out = [];
    const all = this.app.vault.getMarkdownFiles();
    for (let i = 0; i < all.length; i++) {
      const p = all[i].path;
      const wf = rule.watchFolders || [];
      for (let j = 0; j < wf.length; j++) {
        if (p && p.substring(0, wf[j].length + 1) === wf[j] + '/') { out.push(all[i]); break; }
      }
    }
    return out;
  }

  takeSnapshot() {
    this.known = {};
    for (let i = 0; i < this.settings.rules.length; i++) {
      const r = this.settings.rules[i];
      if (!r.enabled) continue;
      this.known[r.id] = {};
      const notes = this.notesIn(r);
      for (let k = 0; k < notes.length; k++) { this.known[r.id][notes[k].path] = notes[k].stat.mtime; }
    }
  }

  tick() {
    this.tickCount++;
    for (let i = 0; i < this.settings.rules.length; i++) {
      const r = this.settings.rules[i];
      if (!r.enabled) continue;
      if (!this.known[r.id]) this.known[r.id] = {};
      const notes = this.notesIn(r);
      for (let k = 0; k < notes.length; k++) {
        const n = notes[k];
        const prev = this.known[r.id][n.path];
        if (prev === undefined || Math.abs(n.stat.mtime - prev) > 500) {
          this.known[r.id][n.path] = n.stat.mtime;
          this.processNote(r, n);
        }
      }
    }
    if (this.settings.deleteOrphanPages && this.tickCount % 12 === 0) {
      this.pruneOrphans().catch(function (e) { console.warn('auto-pages: prune failed ' + e.message); });
    }
  }

  async processNote(rule, file) {
    try {
      const text = await this.app.vault.read(file);
      const values = propertyValues(text, rule.property);
      for (let v = 0; v < values.length; v++) {
        const val = values[v];
        if (!val || INVALID_CHARS.test(val)) continue;
        const target = normalizePath(rule.targetFolder + '/' + (rule.filePattern || '<value>.md').replace(/<value>/g, val));
        if (this.app.vault.getAbstractFileByPath(target)) continue;
        await this.ensureDir(rule.targetFolder);
        let content = '';
        const tplFile = rule.template ? this.app.vault.getAbstractFileByPath(normalizePath(rule.template)) : null;
        if (tplFile) {
          const tpl = await this.app.vault.read(tplFile);
          content = tpl.split('{{title}}').join(val);
        } else {
          content = '---\n' + rule.property + ': ' + val + '\n---\n\n# ' + val + '\n';
        }
        await this.app.vault.create(target, content).then(function () { }, function (e) { console.warn('auto-pages: create failed ' + target + ' -> ' + e.message); });
        if (this.settings.logToVault) { this.appendLog('[' + (rule.name || rule.id) + '] created ' + target + ' <- ' + file.path); }
      }
    } catch (e) {
      console.warn('auto-pages [' + (rule.name || rule.id) + ']: ' + file.path + ' -> ' + String(e && e.message || e));
    }
  }

  async ensureDir(folder) {
    if (!this.app.vault.getAbstractFileByPath(normalizePath(folder))) { await this.app.vault.createFolder(normalizePath(folder)); }
  }

  async pruneOrphans() {
    for (let i = 0; i < this.settings.rules.length; i++) {
      const r = this.settings.rules[i];
      if (!r.enabled) continue;
      const valueSet = {};
      const notes = this.notesIn(r);
      for (let k = 0; k < notes.length; k++) {
        let text = '';
        try { text = await this.app.vault.read(notes[k]); } catch { continue; }
        const vals = propertyValues(text, r.property);
        for (let v = 0; v < vals.length; v++) { if (vals[v]) valueSet[vals[v]] = true; }
      }
      const dir = this.app.vault.getAbstractFileByPath(normalizePath(r.targetFolder));
      if (!dir || !dir.children) continue;
      for (let c = 0; c < dir.children.length; c++) {
        const child = dir.children[c];
        if (child.extension !== 'md') continue;
        let matched = false;
        for (const key in valueSet) {
          if ((r.filePattern || '<value>.md').replace(/<value>/g, key) === child.name) { matched = true; break; }
        }
        if (!matched) { this.app.vault.trashFile(child, false).catch(function () {}); }
      }
    }
  }

  appendLog(line) {
    const self = this;
    const p = normalizePath(this.settings.logPath || 'autopage-log.md');
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const entry = stamp + '  ' + line + '\n';
    const f = this.app.vault.getAbstractFileByPath(p);
    if (f) { self.app.vault.process(f, function (d) { return d + entry; }).catch(function () {}); }
    else { self.app.vault.create(p, '# Auto Pages log\n\n' + entry).catch(function (e) {}); }
  }

  saveSettings() { this.saveData(this.settings); }

  ruleSection(el, rule) {
    const self = this;
    const hdr = new Setting(el).setName('Rule: ' + (rule.name || rule.id)).setDesc('Enable/disable this rule');
    hdr.addToggle(function (tg) {
      tg.setValue(!!rule.enabled).onChange(function (v) {
        rule.enabled = v;
        self.saveSettings();
        if (v) { self.takeSnapshot(); }
      });
    });
    hdr.addButton(function (b) {
      b.setButtonText('Remove').setWarning(true).onClick(function () {
        const idx = self.settings.rules.indexOf(rule);
        if (idx >= 0) { self.settings.rules.splice(idx, 1); self.saveSettings(); self.settingTabInstance.display(); }
      });
    });
    const sName = new Setting(el).setName('Rule name').setDesc('Editable label for this rule (used in logs and this panel)');
    sName.addText(function (t) {
      t.setValue(rule.name || rule.id).onChange(function (v) { rule.name = v.trim() || rule.id; self.saveSettings(); });
    });
    const sWF = new Setting(el).setName('Watch folders').setDesc('Comma-separated vault folders to scan');
    sWF.addText(function (t) {
      t.setPlaceholder('00-inbox, Clippings').setValue((rule.watchFolders || []).join(', ')).onChange(function (v) {
        rule.watchFolders = v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        self.saveSettings(); self.takeSnapshot();
      });
    });
    const sProp = new Setting(el).setName('Property').setDesc('Frontmatter property to read');
    sProp.addText(function (t) { t.setValue(rule.property || '').onChange(function (v) { rule.property = v.trim(); self.saveSettings(); self.takeSnapshot(); }); });
    const sTF = new Setting(el).setName('Target folder').setDesc('Where topic pages are created');
    sTF.addText(function (t) { t.setPlaceholder('10-topics').setValue(rule.targetFolder || '').onChange(function (v) { rule.targetFolder = v.trim(); self.saveSettings(); }); });
    const sFP = new Setting(el).setName('File name pattern').setDesc('Use <value> as placeholder for the property value');
    sFP.addText(function (t) { t.setPlaceholder('<value>.md').setValue(rule.filePattern || '<value>.md').onChange(function (v) { rule.filePattern = v.trim(); self.saveSettings(); }); });
    const sTpl = new Setting(el).setName('Template').setDesc('Markdown template file (optional)');
    sTpl.addText(function (t) { t.setPlaceholder('90-templates/topic-template.md').setValue(rule.template || '').onChange(function (v) { rule.template = v.trim(); self.saveSettings(); }); });
  }
}

class AutoPagesSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const el = this.containerEl;
    if (!el) {
      this._dispTries = (this._dispTries || 0) + 1;
      if (this._dispTries < 10) { const self = this; window.setTimeout(function () { self.display(); }, 2000); }
      return;
    }
    this._dispTries = 0;
    el.empty();
    const plugin = this.plugin;
    for (let i = 0; i < plugin.settings.rules.length; i++) { plugin.ruleSection(el, plugin.settings.rules[i]); }
    const sAdd = new Setting(el).setName('Add rule').setDesc('Add another watch-folder / property / target rule');
    sAdd.addButton(function (b) {
      b.setButtonText('Add').onClick(function () {
        let n = plugin.settings.rules.length + 1;
        let name = 'rule-' + n;
        while (plugin.settings.rules.some(function (x) { return x.name === name; })) { n++; name = 'rule-' + n; }
        const id = 'r' + Date.now();
        plugin.settings.rules.push({ id: id, name: name, enabled: true, watchFolders: ['00-inbox'], property: 'topic', targetFolder: '10-topics', filePattern: '<value>.md', template: '90-templates/topic-template.md' });
        plugin.saveSettings(); plugin.takeSnapshot(); plugin.settingTabInstance.display();
      });
    });
    new Setting(el).setName('Options').setHeading();
    const sInt = new Setting(el).setName('Scan interval (ms)').setDesc('How often watched folders are checked (min 1000)');
    sInt.addText(function (t) {
      t.setPlaceholder('5000').setValue(String(plugin.settings.intervalMs || 5000)).onChange(function (v) {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 1000) { plugin.settings.intervalMs = n; plugin.saveSettings(); plugin.startTimer(); }
      });
    });
    const sOrphan = new Setting(el).setName('Delete orphan pages').setDesc('Periodically trash target pages whose value no longer appears in any watched note (off by default)');
    sOrphan.addToggle(function (tg) { tg.setValue(!!plugin.settings.deleteOrphanPages).onChange(function (v) { plugin.settings.deleteOrphanPages = v; plugin.saveSettings(); }); });
    const sLog = new Setting(el).setName('Log to vault').setDesc('Append creation events to a markdown log file');
    sLog.addToggle(function (tg) { tg.setValue(!!plugin.settings.logToVault).onChange(function (v) { plugin.settings.logToVault = v; plugin.saveSettings(); }); });
    const sLogPath = new Setting(el).setName('Log file');
    sLogPath.addText(function (t) { t.setPlaceholder('autopage-log.md').setValue(plugin.settings.logPath || 'autopage-log.md').onChange(function (v) { if (v.trim()) { plugin.settings.logPath = v.trim(); plugin.saveSettings(); } }); });
  }
}

module.exports = AutoPagesPlugin;