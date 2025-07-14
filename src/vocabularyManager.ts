import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export const vocabularyEventEmitter = new EventEmitter();

const VOCAB_FILE = path.join(__dirname, '../config/vocabularies.json');

export type VocabularyEntry = {
  phrase: string;
  displayAs?: string;
};

export function loadVocabularies(): VocabularyEntry[] {
  if (!fs.existsSync(VOCAB_FILE)) {
    fs.writeFileSync(VOCAB_FILE, '[]', 'utf-8');
    return [];
  }
  const data = fs.readFileSync(VOCAB_FILE, 'utf-8');
  return JSON.parse(data);
}

export function saveVocabularies(vocabularies: VocabularyEntry[]): void {
  fs.writeFileSync(VOCAB_FILE, JSON.stringify(vocabularies, null, 2), 'utf-8');
  vocabularyEventEmitter.emit('vocabulary-updated', vocabularies);
}

export function addVocabulary(entry: VocabularyEntry): void {
  const vocabularies = loadVocabularies();
  vocabularies.push(entry);
  saveVocabularies(vocabularies);
}

export function removeVocabulary(phrase: string): void {
  let vocabularies = loadVocabularies();
  vocabularies = vocabularies.filter(v => v.phrase !== phrase);
  saveVocabularies(vocabularies);
}

export function getVocabularies(): VocabularyEntry[] {
  return loadVocabularies();
}

export function onVocabularyUpdated(callback: (vocabularies: VocabularyEntry[]) => void) {
  vocabularyEventEmitter.on('vocabulary-updated', callback);
} 