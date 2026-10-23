import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

const KEY = 'task-mapper-tasks-v1';
const C = {
  bg: '#F4F6FB',
  white: '#FFFFFF',
  ink: '#172033',
  muted: '#697386',
  line: '#E4E8F1',
  accent: '#5146E5',
  accentSoft: '#EEEDFF',
  blue: '#2563EB',
  blueSoft: '#EAF2FF',
  amber: '#A16207',
  amberSoft: '#FFF5DE',
  green: '#16845B',
  greenSoft: '#E8F7EF',
  red: '#C24141',
  redSoft: '#FFF0F0',
  purple: '#7C3AED',
  purpleSoft: '#F3E8FF'
};

const STATUSES = [
  { key: 'todo', label: 'To do', color: C.blue, soft: C.blueSoft },
  { key: 'doing', label: 'In progress', color: C.amber, soft: C.amberSoft },
  { key: 'done', label: 'Completed', color: C.green, soft: C.greenSoft }
];

const WIP_LIMIT = 4; // Max recommended concurrent in-progress tasks

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isoToday = () => new Date().toISOString().slice(0, 10);

const SAMPLE_TASKS = [
  {
    id: 'sample-1',
    title: 'Review quarterly product roadmap',
    description: 'Sync with product and engineering teams on deliverables.',
    project: 'Work',
    due: isoToday(),
    priority: 'High',
    status: 'doing',
    pinned: true,
    subtasks: [
      { id: 'sub-s1', title: 'Compile completed initiatives', done: true },
      { id: 'sub-s2', title: 'Identify roadmap bottlenecks', done: false },
      { id: 'sub-s3', title: 'Schedule stakeholder sync', done: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-2',
    title: 'Voice navigation testing & review',
    description: 'Verify cross-browser speech recognition in English & Hindi.',
    project: 'Upskillab',
    due: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    priority: 'Medium',
    status: 'todo',
    pinned: false,
    subtasks: [
      { id: 'sub-s4', title: 'Test Hindi keywords (aaj, kal, zaroori)', done: false },
      { id: 'sub-s5', title: 'Review microphone permissions dialog', done: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-3',
    title: 'Task Mapper responsive mobile & web build',
    description: 'Optimized desktop sidebar, Kanban columns, and touch targets.',
    project: 'Dev',
    due: isoToday(),
    priority: 'Low',
    status: 'done',
    pinned: false,
    subtasks: [
      { id: 'sub-s6', title: 'Design responsive layout', done: true },
      { id: 'sub-s7', title: 'Implement local persistence with AsyncStorage', done: true }
    ],
    createdAt: new Date().toISOString()
  }
];

function parseVoice(raw) {
  let title = raw.trim(), project = '', priority = 'Medium', due = '';

  // 1. Project / Category (English and Hindi terms: pariyojana / परियोजना)
  const pm = title.match(/(?:project|category|pariyojana|परियोजना|kategori)\s+([a-z0-9 _\u0900-\u097F-]+?)(?=,|\.|\bdue\b|\bpriority\b|\bzaroori\b|\baaj\b|\bkal\b|$)/i);
  if (pm) {
    project = pm[1].trim();
    title = title.replace(pm[0], '').replace(/[,.]\s*/g, ' ').trim();
  }

  // 2. Priority extraction (English + Hindi)
  if (/\b(high|urgent)\s+priority\b|\bpriority\s+(high|urgent)\b|\b(zaroori|zaruri|khaas|khas|bahut\s+zaroori|जरूरी|खास|अति\s+आवश्यक)\b/i.test(title)) {
    priority = 'High';
    title = title.replace(/\b(high|urgent)\s+priority\b|\bpriority\s+(high|urgent)\b|\b(zaroori|zaruri|khaas|khas|bahut\s+zaroori|जरूरी|खास|अति\s+आवश्यक)\b/gi, '').trim();
  } else if (/\blow\s+priority\b|\bpriority\s+low\b|\b(kam\s+zaroori|chota|kam|कम|हल्का)\b/i.test(title)) {
    priority = 'Low';
    title = title.replace(/\blow\s+priority\b|\bpriority\s+low\b|\b(kam\s+zaroori|chota|kam|कम|हल्का)\b/gi, '').trim();
  } else if (/\bmedium\s+priority\b|\bpriority\s+medium\b|\b(samanya|aam|madhyam|सामान्य|मध्यम)\b/i.test(title)) {
    priority = 'Medium';
    title = title.replace(/\bmedium\s+priority\b|\bpriority\s+medium\b|\b(samanya|aam|madhyam|सामान्य|मध्यम)\b/gi, '').trim();
  }

  // 3. Flexible Date Extraction (English + Hindi: aaj/kal/agle hafte)
  const now = new Date();
  if (/\b(?:due\s+)?(today|aaj|आज)\b/i.test(title)) {
    due = now.toISOString().slice(0, 10);
    title = title.replace(/\b(?:due\s+)?(today|aaj|आज)\b/gi, '').trim();
  } else if (/\b(?:due\s+)?(tomorrow|kal|कल)\b/i.test(title)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    due = d.toISOString().slice(0, 10);
    title = title.replace(/\b(?:due\s+)?(tomorrow|kal|कल)\b/gi, '').trim();
  } else if (/\b(?:due\s+)?(next\s+week|agle\s+hafte|agla\s+hafta|अगले\s+हफ्ते)\b/i.test(title)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    due = d.toISOString().slice(0, 10);
    title = title.replace(/\b(?:due\s+)?(next\s+week|agle\s+hafte|agla\s+hafta|अगले\s+हफ्ते)\b/gi, '').trim();
  }

  return {
    title: title.replace(/^[\s,.-]+|[\s,.-]+$/g, '').replace(/\s{2,}/g, ' ') || raw.trim(),
    project,
    priority,
    due
  };
}

function Btn({ label, onPress, secondary = false, small = false, danger = false, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        secondary && s.btnSecondary,
        small && s.btnSmall,
        danger && s.btnDanger,
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.8 }
      ]}
    >
      <Text style={[s.btnText, secondary && { color: C.ink }, danger && { color: C.red }]}>{label}</Text>
    </Pressable>
  );
}

function Pill({ children, color = C.muted, bg = '#F0F2F7' }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color }]}>{children}</Text>
    </View>
  );
}

function Field({ label, children }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions(), wide = width >= 1000, tablet = width >= 680;
  const [tasks, setTasks] = useState([]), [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [project, setProject] = useState(''), [due, setDue] = useState(''), [priority, setPriority] = useState('Medium'), [status, setStatus] = useState('todo'), [pinned, setPinned] = useState(false), [editing, setEditing] = useState(null);
  const [subtasks, setSubtasks] = useState([]), [subtaskText, setSubtaskText] = useState('');

  // Filters & Sorting state
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('All projects');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [sortBy, setSortBy] = useState('due'); // 'due' | 'priority' | 'newest'

  // Voice state
  const [voiceBusy, setVoiceBusy] = useState(false), [voiceMessage, setVoiceMessage] = useState(''), [voiceDraft, setVoiceDraft] = useState(''), [language, setLanguage] = useState('en-IN');

  // Undo delete toast state
  const [deletedUndo, setDeletedUndo] = useState(null);
  const undoTimerRef = useRef(null);

  // Hidden web file input reference for import
  const fileInputRef = useRef(null);

  useSpeechRecognitionEvent('start', () => { setVoiceBusy(true); setVoiceMessage('Listening… speak your task.'); });
  useSpeechRecognitionEvent('end', () => setVoiceBusy(false));
  useSpeechRecognitionEvent('error', e => { setVoiceBusy(false); setVoiceMessage(e?.message || 'Voice recognition stopped. Try again or type the task.'); });
  useSpeechRecognitionEvent('result', e => { const t = e?.results?.[0]?.transcript || ''; if (t) { setVoiceDraft(t); setVoiceMessage('Voice captured. Review it below.'); } });

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v) {
        const parsed = JSON.parse(v);
        setTasks(parsed);
      } else {
        // First-time onboarding: load sample tasks
        setTasks(SAMPLE_TASKS);
      }
    }).catch(() => {
      setTasks(SAMPLE_TASKS);
    }).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(tasks)).catch(() => { });
  }, [tasks, loaded]);

  const projects = useMemo(() => [...new Set(tasks.map(t => t.project?.trim()).filter(Boolean))].sort(), [tasks]);

  // Filtering & Sorting computation
  const filtered = useMemo(() => {
    const today = isoToday();
    const next7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    return tasks.filter(t => {
      // 1. Text Search
      const q = search.toLowerCase().trim();
      const matchSearch = !q || `${t.title} ${t.description || ''} ${t.project || ''} ${(t.subtasks || []).map(s => s.title).join(' ')}`.toLowerCase().includes(q);

      // 2. Project Filter
      const matchProject = projectFilter === 'All projects' || (t.project || '').trim() === projectFilter;

      // 3. Priority Filter
      const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;

      // 4. Date Status Filter
      let matchDate = true;
      if (dateFilter === 'Overdue') {
        matchDate = t.due && t.due < today && t.status !== 'done';
      } else if (dateFilter === 'Today') {
        matchDate = t.due === today;
      } else if (dateFilter === 'This week') {
        matchDate = t.due && t.due >= today && t.due <= next7Days;
      } else if (dateFilter === 'No date') {
        matchDate = !t.due;
      }

      return matchSearch && matchProject && matchPriority && matchDate;
    }).sort((a, b) => {
      // Pinned items stay on top
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Apply selected sort
      if (sortBy === 'priority') {
        const pOrder = { High: 3, Medium: 2, Low: 1 };
        return (pOrder[b.priority] || 2) - (pOrder[a.priority] || 2);
      }
      if (sortBy === 'newest') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      // Default: Due date
      return (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99');
    });
  }, [tasks, search, projectFilter, priorityFilter, dateFilter, sortBy]);

  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    doing: tasks.filter(t => t.status === 'doing').length,
    done: tasks.filter(t => t.status === 'done').length
  };
  const overdueCount = tasks.filter(t => t.due && t.due < isoToday() && t.status !== 'done').length;
  const pct = tasks.length ? Math.round(counts.done / tasks.length * 100) : 0;

  const reset = () => {
    setTitle('');
    setDescription('');
    setProject('');
    setDue('');
    setPriority('Medium');
    setStatus('todo');
    setPinned(false);
    setSubtasks([]);
    setSubtaskText('');
    setEditing(null);
  };

  const addSubtask = () => {
    const trimmed = subtaskText.trim();
    if (!trimmed) return;
    setSubtasks(old => [...old, { id: makeId(), title: trimmed, done: false }]);
    setSubtaskText('');
  };

  const removeSubtask = (id) => {
    setSubtasks(old => old.filter(s => s.id !== id));
  };

  const toggleFormSubtask = (id) => {
    setSubtasks(old => old.map(s => s.id === id ? { ...s, done: !s.done } : s));
  };

  const toggleCardSubtask = (taskId, subId) => {
    setTasks(old => old.map(t => {
      if (t.id !== taskId) return t;
      const updated = (t.subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s);
      return { ...t, subtasks: updated };
    }));
  };

  const save = () => {
    if (!title.trim()) {
      Alert.alert('Task name required', 'Enter a task name before saving.');
      return;
    }
    const cleanSubtasks = subtasks.filter(s => s.title.trim());
    const data = {
      title: title.trim(),
      description: description.trim(),
      project: project.trim(),
      due,
      priority,
      status,
      pinned,
      subtasks: cleanSubtasks
    };
    if (editing) setTasks(old => old.map(t => t.id === editing ? { ...t, ...data } : t));
    else setTasks(old => [{ id: makeId(), ...data, createdAt: new Date().toISOString() }, ...old]);
    reset();
  };

  const edit = t => {
    setTitle(t.title);
    setDescription(t.description || '');
    setProject(t.project || '');
    setDue(t.due || '');
    setPriority(t.priority || 'Medium');
    setStatus(t.status || 'todo');
    setPinned(!!t.pinned);
    setSubtasks(t.subtasks ? JSON.parse(JSON.stringify(t.subtasks)) : []);
    setSubtaskText('');
    setEditing(t.id);
  };

  const remove = t => {
    const doDelete = () => {
      setDeletedUndo(t);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setDeletedUndo(null), 6000);
      setTasks(old => old.filter(x => x.id !== t.id));
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      doDelete();
    } else {
      Alert.alert('Delete task?', t.title, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  const undoDelete = () => {
    if (deletedUndo) {
      setTasks(old => [deletedUndo, ...old]);
      setDeletedUndo(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    }
  };

  // Card Quick Actions
  const togglePin = (id) => {
    setTasks(old => old.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x));
  };

  const duplicateTask = (t) => {
    const clone = {
      ...t,
      id: makeId(),
      title: `${t.title} (Copy)`,
      createdAt: new Date().toISOString(),
      subtasks: (t.subtasks || []).map(s => ({ ...s, id: makeId() }))
    };
    setTasks(old => [clone, ...old]);
  };

  const toggleHighPriority = (id) => {
    setTasks(old => old.map(x => x.id === id ? { ...x, priority: x.priority === 'High' ? 'Medium' : 'High' } : x));
  };

  // Bidirectional Column Movement
  const moveTo = (id, targetStatus) => {
    setTasks(old => old.map(x => x.id === id ? { ...x, status: targetStatus } : x));
  };

  const startVoice = () => {
    setVoiceMessage('');
    if (Platform.OS === 'web') {
      const Speech = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
      if (!Speech) { setVoiceMessage('Voice input is not supported in this browser. Try Google Chrome or Edge.'); return; }
      const rec = new Speech();
      rec.lang = language;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = e => {
        const t = e.results?.[0]?.[0]?.transcript || '';
        setVoiceDraft(t);
        setVoiceMessage(t ? 'Voice captured. Review parsed details below.' : 'No speech detected. Try again.');
      };
      rec.onerror = e => { setVoiceBusy(false); setVoiceMessage(`Microphone error: ${e.error}. Check browser permissions.`); };
      rec.onend = () => setVoiceBusy(false);
      try { setVoiceBusy(true); setVoiceMessage('Listening… speak your task.'); rec.start(); }
      catch { setVoiceBusy(false); setVoiceMessage('Could not start microphone. Check permissions.'); }
      return;
    }
    ExpoSpeechRecognitionModule.requestPermissionsAsync().then(r => {
      if (!r.granted) { setVoiceMessage('Microphone permission is required for voice input.'); return; }
      ExpoSpeechRecognitionModule.start({ lang: language, interimResults: false, maxAlternatives: 1 });
    }).catch(() => setVoiceMessage('Voice recognition unavailable in this build.'));
  };

  const useVoice = () => {
    if (!voiceDraft.trim()) return;
    const p = parseVoice(voiceDraft);
    setTitle(p.title);
    setProject(p.project);
    setPriority(p.priority);
    setDue(p.due);
    setStatus('todo');
    setVoiceDraft('');
    setVoiceMessage('Details filled into form. Review and click "Add task".');
  };

  // Data Export & Import Handlers
  const exportTasks = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `task-mapper-export-${isoToday()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('Backup Ready', `You have ${tasks.length} tasks stored. Exporting on mobile can be done via web or cloud sync.`);
    }
  };

  const triggerImport = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      Alert.alert('Import Tasks', 'Importing JSON files is currently supported in desktop and web browsers.');
    }
  };

  const handleWebFileSelect = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          // Merge avoiding ID collisions
          const existingIds = new Set(tasks.map(t => t.id));
          const newItems = imported.filter(t => !existingIds.has(t.id));
          setTasks(old => [...newItems, ...old]);
          Alert.alert('Import Successful', `Imported ${newItems.length} new tasks.`);
        } else {
          Alert.alert('Import Failed', 'Selected file does not contain a valid task list.');
        }
      } catch (err) {
        Alert.alert('Invalid File', 'Could not parse the JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadSampleData = () => {
    setTasks(SAMPLE_TASKS);
    reset();
  };

  if (!loaded) return <SafeAreaView style={s.loading}><Text style={{ color: C.accent, fontSize: 18, fontWeight: '800' }}>Loading Task Mapper…</Text></SafeAreaView>;

  const form = (
    <View style={s.panel}>
      <View style={s.panelHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.panelTitle}>{editing ? 'Edit task' : 'Create a task'}</Text>
          <Text style={s.sub}>Capture it, break it into steps, get it done.</Text>
        </View>
        {editing ? <Btn label="Cancel" secondary small onPress={reset} /> : null}
      </View>

      <View style={s.voiceBox}>
        <View style={s.voiceHead}>
          <View style={s.mic}><Text style={{ fontSize: 19 }}>🎙️</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.voiceTitle}>Create by voice (Bilingual)</Text>
            <Text style={s.sub}>Speak in English or Hindi (e.g. “Project Dev, zaroori, kal”).</Text>
          </View>
        </View>
        <View style={[s.row, { alignItems: 'center', flexWrap: 'wrap' }]}>
          <View style={s.langs}>
            {[['en-IN', 'English'], ['hi-IN', 'Hindi']].map(([v, l]) => (
              <Pressable key={v} onPress={() => setLanguage(v)} style={[s.lang, v === language && s.langActive]}>
                <Text style={[s.langText, v === language && { color: C.accent }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
          <Btn label={voiceBusy ? 'Listening…' : '🎤 Start speaking'} onPress={startVoice} disabled={voiceBusy} small />
        </View>
        {!!voiceMessage && <Text style={s.voiceMessage}>{voiceMessage}</Text>}
        {!!voiceDraft && (
          <View style={s.voiceDraft}>
            <Text style={s.label}>RECOGNIZED SPEECH</Text>
            <Text style={s.voiceTranscript}>{voiceDraft}</Text>
            <View style={[s.row, { marginTop: 10 }]}>
              <Btn label="Parse & Use task" onPress={useVoice} small />
              <Btn label="Discard" secondary onPress={() => setVoiceDraft('')} small />
            </View>
          </View>
        )}
      </View>

      <Field label="TASK NAME *">
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Prepare weekly report" placeholderTextColor="#9AA3B2" style={s.input} />
      </Field>

      <Field label="DESCRIPTION / NOTES">
        <TextInput value={description} onChangeText={setDescription} placeholder="Add details or context…" placeholderTextColor="#9AA3B2" style={[s.input, { minHeight: 65, textAlignVertical: 'top' }]} multiline />
      </Field>

      <Field label="CHECKLIST / SUBTASKS">
        <View style={s.subtaskInputRow}>
          <TextInput
            value={subtaskText}
            onChangeText={setSubtaskText}
            onSubmitEditing={addSubtask}
            placeholder="Add a step or subtask…"
            placeholderTextColor="#9AA3B2"
            style={[s.input, { flex: 1 }]}
            returnKeyType="done"
          />
          <Btn label="＋ Add" onPress={addSubtask} small disabled={!subtaskText.trim()} />
        </View>
        {subtasks.length > 0 && (
          <View style={s.subtaskList}>
            {subtasks.map(sub => (
              <View key={sub.id} style={s.subtaskFormItem}>
                <Pressable onPress={() => toggleFormSubtask(sub.id)} style={[s.subCheck, sub.done && s.subCheckDone]}>
                  <Text style={s.subCheckText}>{sub.done ? '✓' : ''}</Text>
                </Pressable>
                <Text style={[s.subText, sub.done && s.subTextDone]}>{sub.title}</Text>
                <Pressable onPress={() => removeSubtask(sub.id)} style={s.subtaskRemoveBtn}>
                  <Text style={s.subtaskRemoveText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Field>

      <Field label="PROJECT / CATEGORY">
        <TextInput value={project} onChangeText={setProject} placeholder="Work, Personal, Upskillab…" placeholderTextColor="#9AA3B2" style={s.input} />
      </Field>

      <View style={tablet ? s.row : s.stack}>
        <View style={{ flex: 1 }}>
          <Field label="DUE DATE (YYYY-MM-DD)">
            <TextInput value={due} onChangeText={setDue} placeholder="2026-10-30" placeholderTextColor="#9AA3B2" style={s.input} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="PRIORITY">
            <View style={s.segment}>
              {['Low', 'Medium', 'High'].map(p => (
                <Pressable key={p} onPress={() => setPriority(p)} style={[s.choice, priority === p && s.choiceActive]}>
                  <Text style={[s.choiceText, priority === p && { color: C.accent }]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </Field>
        </View>
      </View>

      <Field label="STATUS">
        <View style={s.segment}>
          {STATUSES.map(x => (
            <Pressable key={x.key} onPress={() => setStatus(x.key)} style={[s.choice, { flex: 1 }, status === x.key && { backgroundColor: x.soft, borderColor: x.color }]}>
              <Text style={[s.choiceText, status === x.key && { color: x.color }]}>{x.label}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Pressable onPress={() => setPinned(!pinned)} style={s.pinOption}>
        <Text style={{ fontSize: 15 }}>{pinned ? '📌' : '📍'}</Text>
        <Text style={[s.sub, { marginTop: 0, fontWeight: '700', color: pinned ? C.accent : C.muted }]}>
          {pinned ? 'Pinned to top of column' : 'Pin to top of column'}
        </Text>
      </Pressable>

      <Btn label={editing ? 'Save changes' : '＋ Add task'} onPress={save} />
    </View>
  );

  const card = t => {
    const st = STATUSES.find(x => x.key === t.status) || STATUSES[0];
    const overdue = t.due && t.due < isoToday() && t.status !== 'done';
    const subList = t.subtasks || [];
    const totalSubs = subList.length;
    const doneSubs = subList.filter(s => s.done).length;
    const subPct = totalSubs ? Math.round((doneSubs / totalSubs) * 100) : 0;

    return (
      <View key={t.id} style={[s.taskCard, t.pinned && s.taskCardPinned]}>
        <View style={s.taskTop}>
          <Pressable
            onPress={() => setTasks(old => old.map(x => x.id === t.id ? { ...x, status: x.status === 'done' ? 'todo' : 'done' } : x))}
            style={[s.check, t.status === 'done' && { backgroundColor: C.green, borderColor: C.green }]}
          >
            <Text style={{ color: '#FFF', fontWeight: '900' }}>{t.status === 'done' ? '✓' : ''}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {t.pinned ? <Text style={{ fontSize: 11 }}>📌</Text> : null}
              <Text style={[s.taskTitle, t.status === 'done' && { textDecorationLine: 'line-through', color: '#8A93A2' }]}>{t.title}</Text>
            </View>
            {!!t.description && <Text style={s.taskDesc}>{t.description}</Text>}
          </View>
          <View style={[s.dot, { backgroundColor: st.color }]} />
        </View>

        {totalSubs > 0 && (
          <View style={s.subtaskCardBox}>
            <View style={s.subtaskProgressRow}>
              <Text style={s.subtaskProgressText}>Subtasks: {doneSubs}/{totalSubs}</Text>
              <Text style={[s.subtaskProgressText, doneSubs === totalSubs && { color: C.green }]}>{subPct}%</Text>
            </View>
            <View style={s.subtaskTrack}>
              <View style={[s.subtaskFill, { width: `${subPct}%` }, doneSubs === totalSubs && s.subtaskFillDone]} />
            </View>
            <View style={{ gap: 5 }}>
              {subList.map(sub => (
                <Pressable key={sub.id} onPress={() => toggleCardSubtask(t.id, sub.id)} style={s.subtaskItem}>
                  <View style={[s.subCheck, sub.done && s.subCheckDone]}>
                    <Text style={s.subCheckText}>{sub.done ? '✓' : ''}</Text>
                  </View>
                  <Text style={[s.subText, sub.done && s.subTextDone]}>{sub.title}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={s.tags}>
          <Pill>{t.project || 'Unassigned'}</Pill>
          <Pill color={t.priority === 'High' ? C.red : t.priority === 'Low' ? C.green : C.amber} bg={t.priority === 'High' ? C.redSoft : t.priority === 'Low' ? C.greenSoft : C.amberSoft}>{t.priority} priority</Pill>
          {!!t.due && <Pill color={overdue ? C.red : C.muted} bg={overdue ? C.redSoft : '#F0F2F7'}>{overdue ? 'Overdue · ' : ''}{t.due}</Pill>}
        </View>

        {/* Bidirectional Movement Buttons */}
        <View style={s.moveRow}>
          <Text style={s.moveLabel}>Stage:</Text>
          {t.status === 'todo' && (
            <Pressable onPress={() => moveTo(t.id, 'doing')} style={s.stageBtn}>
              <Text style={s.stageBtnText}>→ In progress</Text>
            </Pressable>
          )}
          {t.status === 'doing' && (
            <>
              <Pressable onPress={() => moveTo(t.id, 'todo')} style={s.stageBtn}>
                <Text style={s.stageBtnText}>← To do</Text>
              </Pressable>
              <Pressable onPress={() => moveTo(t.id, 'done')} style={[s.stageBtn, { backgroundColor: C.greenSoft }]}>
                <Text style={[s.stageBtnText, { color: C.green }]}>→ Complete</Text>
              </Pressable>
            </>
          )}
          {t.status === 'done' && (
            <Pressable onPress={() => moveTo(t.id, 'doing')} style={s.stageBtn}>
              <Text style={s.stageBtnText}>← Reopen to Doing</Text>
            </Pressable>
          )}
        </View>

        {/* Card Quick-Actions Toolbar */}
        <View style={s.actions}>
          <Pressable onPress={() => togglePin(t.id)}>
            <Text style={s.actionText}>{t.pinned ? 'Unpin' : '📌 Pin'}</Text>
          </Pressable>
          <Pressable onPress={() => toggleHighPriority(t.id)}>
            <Text style={[s.actionText, t.priority === 'High' && { color: C.red }]}>{t.priority === 'High' ? '★ High' : '☆ Normal'}</Text>
          </Pressable>
          <Pressable onPress={() => duplicateTask(t)}>
            <Text style={s.actionText}>⧉ Duplicate</Text>
          </Pressable>
          <Pressable onPress={() => edit(t)}>
            <Text style={s.actionText}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => remove(t)}>
            <Text style={[s.actionText, { color: C.red }]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">

          {/* Hidden File Input for Web Import */}
          {Platform.OS === 'web' && (
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleWebFileSelect}
              accept=".json"
              style={{ display: 'none' }}
            />
          )}

          {/* Undo Delete Toast Banner */}
          {!!deletedUndo && (
            <View style={s.undoBanner}>
              <Text style={s.undoText}>Task “{deletedUndo.title}” deleted.</Text>
              <Pressable onPress={undoDelete} style={s.undoBtn}>
                <Text style={s.undoBtnText}>Undo</Text>
              </Pressable>
            </View>
          )}

          {/* Header Bar */}
          <View style={s.header}>
            <View style={s.brand}>
              <View style={s.logo}><Text style={s.logoText}>✓</Text></View>
              <View>
                <Text style={s.eyebrow}>ENTERPRISE PRODUCTIVITY</Text>
                <Text style={s.appTitle}>Task Mapper</Text>
                <Text style={s.sub}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
              </View>
            </View>

            <View style={s.headerActions}>
              <Pressable onPress={exportTasks} style={s.toolBtn}>
                <Text style={s.toolBtnText}>⬇ Export JSON</Text>
              </Pressable>
              <Pressable onPress={triggerImport} style={s.toolBtn}>
                <Text style={s.toolBtnText}>⬆ Import JSON</Text>
              </Pressable>
              <Pressable onPress={loadSampleData} style={s.toolBtnSecondary}>
                <Text style={s.toolBtnSecondaryText}>✨ Starter Demo</Text>
              </Pressable>
              <View style={s.savedBadge}>
                <View style={s.greenDot} />
                <Text style={{ color: C.green, fontSize: 11, fontWeight: '800' }}>Local Offline Sync</Text>
              </View>
            </View>
          </View>

          {/* Metrics & Analytics Bar */}
          <View style={[s.stats, !tablet && { flexWrap: 'wrap' }]}>
            {[
              { label: 'Total tasks', value: tasks.length, sub: 'Across all projects', color: C.accent },
              { label: 'To do', value: counts.todo, sub: 'Ready to start', color: C.blue },
              { label: 'In progress', value: counts.doing, sub: counts.doing > WIP_LIMIT ? '⚠️ Over WIP limit' : 'Under active work', color: counts.doing > WIP_LIMIT ? C.red : C.amber },
              { label: 'Completed', value: counts.done, sub: `${pct}% completion rate`, color: C.green },
            ].map(x => (
              <View key={x.label} style={s.stat}>
                <Text style={s.statLabel}>{x.label}</Text>
                <Text style={[s.statValue, { color: x.color }]}>{x.value}</Text>
                <Text style={s.sub}>{x.sub}</Text>
                {x.label === 'Completed' && (
                  <View style={s.progress}>
                    <View style={[s.progressFill, { width: `${pct}%` }]} />
                  </View>
                )}
              </View>
            ))}

            {overdueCount > 0 && (
              <View style={[s.stat, { borderColor: C.red, backgroundColor: C.redSoft }]}>
                <Text style={[s.statLabel, { color: C.red }]}>Overdue alert</Text>
                <Text style={[s.statValue, { color: C.red }]}>{overdueCount}</Text>
                <Text style={[s.sub, { color: C.red }]}>Require immediate focus</Text>
              </View>
            )}
          </View>

          {/* Main Area */}
          <View style={[s.main, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
            <View style={[wide && { width: 370, flexShrink: 0 }]}>{form}</View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.workspaceHead}>
                <View>
                  <Text style={s.panelTitle}>Workspace Kanban</Text>
                  <Text style={s.sub}>Prioritize next steps and limit multitasking.</Text>
                </View>
                <Pill>{filtered.length} tasks shown</Pill>
              </View>

              {/* Text Search Input */}
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="⌕  Search title, description, notes, subtasks or project…"
                placeholderTextColor="#8C95A6"
                style={[s.input, { marginBottom: 12 }]}
              />

              {/* Multi-Dimensional Filters Bar */}
              <View style={s.filterRow}>
                {/* Priority Filter */}
                <View style={s.filterGroup}>
                  <Text style={s.filterGroupLabel}>PRIORITY:</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {['All', 'High', 'Medium', 'Low'].map(p => (
                      <Pressable key={p} onPress={() => setPriorityFilter(p)} style={[s.smallFilter, priorityFilter === p && s.smallFilterActive]}>
                        <Text style={[s.smallFilterText, priorityFilter === p && { color: C.accent }]}>{p}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Date Status Filter */}
                <View style={s.filterGroup}>
                  <Text style={s.filterGroupLabel}>TIMELINE:</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {['All', 'Overdue', 'Today', 'This week'].map(d => (
                      <Pressable key={d} onPress={() => setDateFilter(d)} style={[s.smallFilter, dateFilter === d && s.smallFilterActive]}>
                        <Text style={[s.smallFilterText, dateFilter === d && { color: C.accent }]}>{d}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Sort Option */}
                <View style={s.filterGroup}>
                  <Text style={s.filterGroupLabel}>SORT:</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[
                      { key: 'due', label: 'Due date' },
                      { key: 'priority', label: 'Priority' },
                      { key: 'newest', label: 'Newest' }
                    ].map(sItem => (
                      <Pressable key={sItem.key} onPress={() => setSortBy(sItem.key)} style={[s.smallFilter, sortBy === sItem.key && s.smallFilterActive]}>
                        <Text style={[s.smallFilterText, sortBy === sItem.key && { color: C.accent }]}>{sItem.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* Project Categories Filter Bar */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 10 }}>
                {['All projects', ...projects].map(p => (
                  <Pressable key={p} onPress={() => setProjectFilter(p)} style={[s.filter, projectFilter === p && s.filterActive]}>
                    <Text style={[s.filterText, projectFilter === p && { color: C.accent }]}>{p}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Kanban Columns */}
              <View style={[s.board, !wide && { flexDirection: 'column' }]}>
                {STATUSES.map(st => {
                  const items = filtered.filter(t => t.status === st.key);
                  const isDoingOverLimit = st.key === 'doing' && items.length > WIP_LIMIT;

                  return (
                    <View key={st.key} style={[s.column, wide && { minWidth: 200 }]}>
                      <View style={s.columnHead}>
                        <View style={[s.dot, { backgroundColor: st.color }]} />
                        <Text style={s.columnTitle}>{st.label}</Text>
                        <Pill>{items.length}</Pill>
                      </View>

                      {/* WIP Limit Alert Banner */}
                      {isDoingOverLimit && (
                        <View style={s.wipBanner}>
                          <Text style={s.wipText}>⚠️ WIP Limit ({items.length}/{WIP_LIMIT}): Focus on finishing active tasks!</Text>
                        </View>
                      )}

                      {items.length ? (
                        items.map(card)
                      ) : (
                        <View style={s.empty}>
                          <Text style={{ fontSize: 22, color: '#A5ADBC' }}>◇</Text>
                          <Text style={s.emptyTitle}>Nothing in {st.label.toLowerCase()}</Text>
                          <Text style={s.sub}>Tasks in this stage show here.</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Mapped Projects Summary */}
              <View style={s.projects}>
                <Text style={s.panelTitle}>Mapped Categories & Projects</Text>
                <Text style={s.sub}>Auto-grouped from your tasks.</Text>
                <View style={s.projectList}>
                  {projects.length ? (
                    projects.map(p => (
                      <Pressable key={p} onPress={() => setProjectFilter(p)} style={s.projectChip}>
                        <Text style={{ fontWeight: '800', fontSize: 12, color: C.ink }}>{p}</Text>
                        <Text style={s.sub}>{tasks.filter(t => t.project?.trim() === p).length} tasks</Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={s.sub}>Add a project/category to see it here.</Text>
                  )}
                </View>
              </View>

              <Text style={s.footer}>Task Mapper · Enhanced Kanban, Voice, Multi-Dimensional Filtering & Local Data Portability</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  page: { width: '100%', maxWidth: 1550, alignSelf: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 24 : 14, paddingBottom: 42 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15, marginBottom: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 15, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFF', fontSize: 27, fontWeight: '900' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: C.muted },
  appTitle: { fontSize: 28, fontWeight: '900', color: C.ink, letterSpacing: -0.7 },
  sub: { fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  toolBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  toolBtnText: { fontSize: 11, fontWeight: '800', color: C.ink },
  toolBtnSecondary: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: '#D9D5FF' },
  toolBtnSecondaryText: { fontSize: 11, fontWeight: '800', color: C.accent },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 30, backgroundColor: C.greenSoft },
  greenDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: C.green },
  undoBanner: { backgroundColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  undoText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  undoBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C.accent, borderRadius: 6 },
  undoBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  stat: { flex: 1, minWidth: 135, padding: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16 },
  statLabel: { fontSize: 12, fontWeight: '700', color: C.muted },
  statValue: { fontSize: 30, fontWeight: '900', marginTop: 4 },
  progress: { height: 5, backgroundColor: '#EDF0F6', borderRadius: 8, overflow: 'hidden', marginTop: 9 },
  progressFill: { height: '100%', backgroundColor: C.green },
  main: { gap: 18 },
  panel: { padding: 17, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, marginBottom: 18 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  panelTitle: { fontSize: 18, fontWeight: '900', color: C.ink },
  voiceBox: { backgroundColor: '#F6F5FF', borderWidth: 1, borderColor: '#E5E2FF', borderRadius: 14, padding: 12, marginBottom: 17 },
  voiceHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  mic: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#E9E6FF', alignItems: 'center', justifyContent: 'center' },
  voiceTitle: { fontSize: 13, fontWeight: '900', color: C.ink },
  row: { flexDirection: 'row', gap: 8 },
  stack: { gap: 0 },
  langs: { flexDirection: 'row', gap: 4, flex: 1 },
  lang: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  langActive: { backgroundColor: '#FFF', borderColor: '#D9D5FF' },
  langText: { fontSize: 11, fontWeight: '800', color: C.muted },
  voiceMessage: { fontSize: 12, color: C.accent, marginTop: 10, lineHeight: 18 },
  voiceDraft: { backgroundColor: '#FFF', padding: 10, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: C.line },
  voiceTranscript: { fontSize: 13, color: C.ink, marginTop: 4 },
  field: { marginBottom: 13, flex: 1 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, color: C.muted, marginBottom: 6 },
  input: { width: '100%', minHeight: 42, paddingHorizontal: 11, paddingVertical: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 10, color: C.ink, fontSize: 13 },
  segment: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  choice: { flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: '#FFF' },
  choiceActive: { backgroundColor: C.accentSoft, borderColor: C.accent },
  choiceText: { fontSize: 11, fontWeight: '800', color: C.muted },
  pinOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginBottom: 14 },
  btn: { minHeight: 42, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent },
  btnSecondary: { backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line },
  btnSmall: { minHeight: 33, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  btnDanger: { backgroundColor: C.redSoft },
  btnText: { fontSize: 12, fontWeight: '900', color: '#FFF' },
  workspaceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 10, alignItems: 'center' },
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterGroupLabel: { fontSize: 10, fontWeight: '900', color: C.muted, letterSpacing: 0.6 },
  smallFilter: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  smallFilterActive: { backgroundColor: C.accentSoft, borderColor: C.accent },
  smallFilterText: { fontSize: 10, fontWeight: '800', color: C.muted },
  filter: { paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 20 },
  filterActive: { backgroundColor: C.accentSoft, borderColor: '#D7D2FF' },
  filterText: { fontSize: 11, fontWeight: '800', color: C.muted },
  board: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0, padding: 10, backgroundColor: '#EEF1F8', borderRadius: 15, borderWidth: 1, borderColor: '#E5E9F2' },
  columnHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 11, paddingHorizontal: 3 },
  dot: { width: 7, height: 7, borderRadius: 5 },
  columnTitle: { flex: 1, fontSize: 12, fontWeight: '900', color: C.ink },
  wipBanner: { backgroundColor: C.amberSoft, borderWidth: 1, borderColor: C.amber, padding: 6, borderRadius: 8, marginBottom: 10 },
  wipText: { fontSize: 10, fontWeight: '800', color: C.amber, textAlign: 'center' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F0F2F7' },
  pillText: { fontSize: 9, fontWeight: '900' },
  taskCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 11, marginBottom: 9 },
  taskCardPinned: { borderColor: C.accent, borderWidth: 1.5 },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  check: { width: 19, height: 19, borderRadius: 6, borderWidth: 1.5, borderColor: '#C9CFDC', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  taskTitle: { fontSize: 13, fontWeight: '900', color: C.ink, lineHeight: 19 },
  taskDesc: { fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F2F6', flexWrap: 'wrap' },
  moveLabel: { fontSize: 9, fontWeight: '900', color: C.muted },
  stageBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F0F2F7' },
  stageBtnText: { fontSize: 10, fontWeight: '800', color: C.ink },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F2F6', flexWrap: 'wrap' },
  actionText: { fontSize: 10, fontWeight: '900', color: C.accent },
  empty: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 24 },
  emptyTitle: { fontSize: 12, fontWeight: '900', color: C.ink, marginTop: 5 },
  projects: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, marginTop: 17 },
  projectList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  projectChip: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: '#FAFBFD' },
  footer: { fontSize: 10, color: '#929AAA', textAlign: 'center', marginTop: 18 },
  subtaskInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  subtaskList: { marginTop: 8, gap: 4 },
  subtaskFormItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F2F6' },
  subtaskCardBox: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
  subtaskProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  subtaskProgressText: { fontSize: 10, fontWeight: '800', color: C.muted },
  subtaskTrack: { height: 4, backgroundColor: '#EDF0F6', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  subtaskFill: { height: '100%', backgroundColor: C.accent },
  subtaskFillDone: { backgroundColor: C.green },
  subtaskItem: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  subCheck: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.2, borderColor: '#C9CFDC', alignItems: 'center', justifyContent: 'center' },
  subCheckDone: { backgroundColor: C.green, borderColor: C.green },
  subCheckText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  subText: { fontSize: 11, color: C.ink, flex: 1 },
  subTextDone: { textDecorationLine: 'line-through', color: '#8A93A2' },
  subtaskRemoveBtn: { padding: 4 },
  subtaskRemoveText: { color: C.muted, fontSize: 12, fontWeight: '700' }
});
taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
check: { width: 19, height: 19, borderRadius: 6, borderWidth: 1.5, borderColor: '#C9CFDC', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
taskTitle: { fontSize: 13, fontWeight: '900', color: C.ink, lineHeight: 19 },
taskDesc: { fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 5 },
tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
moveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F2F6', flexWrap: 'wrap' },
moveLabel: { fontSize: 9, fontWeight: '900', color: C.muted },
stageBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F0F2F7' },
stageBtnText: { fontSize: 10, fontWeight: '800', color: C.ink },
actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F2F6', flexWrap: 'wrap' },
actionText: { fontSize: 10, fontWeight: '900', color: C.accent },
empty: { alignItems: 'center', paddingHorizontal: 8, paddingVertical: 24 },
emptyTitle: { fontSize: 12, fontWeight: '900', color: C.ink, marginTop: 5 },
projects: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, marginTop: 17 },
projectList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
projectChip: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: '#FAFBFD' },
footer: { fontSize: 10, color: '#929AAA', textAlign: 'center', marginTop: 18 },
subtaskInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
subtaskList: { marginTop: 8, gap: 4 },
subtaskFormItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F2F6' },
subtaskCardBox: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F0F2F6' },
subtaskProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
subtaskProgressText: { fontSize: 10, fontWeight: '800', color: C.muted },
subtaskTrack: { height: 4, backgroundColor: '#EDF0F6', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
subtaskFill: { height: '100%', backgroundColor: C.accent },
subtaskFillDone: { backgroundColor: C.green },
subtaskItem: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
subCheck: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.2, borderColor: '#C9CFDC', alignItems: 'center', justifyContent: 'center' },
subCheckDone: { backgroundColor: C.green, borderColor: C.green },
subCheckText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
subText: { fontSize: 11, color: C.ink, flex: 1 },
subTextDone: { textDecorationLine: 'line-through', color: '#8A93A2' },
subtaskRemoveBtn: { padding: 4 },
subtaskRemoveText: { color: C.muted, fontSize: 12, fontWeight: '700' },
parsedCard: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 10, marginTop: 10 },
parsedCardTitle: { fontSize: 9, fontWeight: '900', color: C.muted, letterSpacing: 0.6, marginBottom: 7 },
parsedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }
});
