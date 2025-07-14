import fs from 'fs';
import path from 'path';
import {
  addVocabulary,
  removeVocabulary,
  getVocabularies,
  onVocabularyUpdated,
  VocabularyEntry,
} from '../src/vocabularyManager';

describe('Vocabulary Manager', () => {
  const tempVocabFile = path.join(__dirname, '../config/vocabularies.json');
  beforeEach(() => {
    if (fs.existsSync(tempVocabFile)) fs.unlinkSync(tempVocabFile);
  });

  it('should load an empty vocabulary list if file does not exist', () => {
    const vocab = getVocabularies();
    expect(Array.isArray(vocab)).toBe(true);
    expect(vocab.length).toBe(0);
  });

  it('should add a vocabulary entry', () => {
    addVocabulary({ phrase: 'testword', displayAs: 'Test Word' });
    const vocab = getVocabularies();
    expect(vocab.length).toBe(1);
    expect(vocab[0].phrase).toBe('testword');
  });

  it('should remove a vocabulary entry', () => {
    addVocabulary({ phrase: 'toremove' });
    removeVocabulary('toremove');
    const vocab = getVocabularies();
    expect(vocab.find(v => v.phrase === 'toremove')).toBeUndefined();
  });

  it('should emit an event when vocabulary is updated', (done) => {
    onVocabularyUpdated((vocab) => {
      expect(vocab.some(v => v.phrase === 'eventword')).toBe(true);
      done();
    });
    addVocabulary({ phrase: 'eventword' });
  });
}); 