import React, { useState, useMemo } from 'react';
import {
  FileText,
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Minimize2,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  Copy,
  Upload,
  Network,
  AlertCircle,
  PenTool,
  Layers
} from 'lucide-react';
import {
  ApiConfig,
  MemoryNeuron,
  NeuralKnowledgeBase,
  OutlineDocumentType,
  OutlineSectionItem,
  StructuredOutline,
  UploadedDocument
} from '../types';
import {
  generateStructuredOutline,
  transformOutlineSection,
  generateFullDraftFromOutline
} from '../utils/apiProxy';
import { findRelevantNeurons } from '../utils/neuralMemory';

interface OutlineStudioPanelProps {
  apiConfig: ApiConfig;
  knowledgeBase: NeuralKnowledgeBase;
  webpageTitle: string;
  webpageText: string;
  selectedText: string;
  uploadedDocs: UploadedDocument[];
  onAddUploadedDoc: (doc: Omit<UploadedDocument, 'id' | 'addedAt' | 'wordCount'>) => void;
  onRemoveUploadedDoc: (docId: string) => void;
  onSaveInsightToGraph: (text: string, title: string) => void;
}

const ASSIGNMENT_PRESETS: {
  id: string;
  label: string;
  docType: OutlineDocumentType;
  prompt: string;
  rubric: string;
}[] = [
  {
    id: 'preset-hybrid-ai',
    label: 'Research Paper: Hybrid Edge-Cloud AI Architecture',
    docType: 'research_paper',
    prompt:
      'Write a rigorous analytical research paper evaluating how hybrid edge-cloud LLM routing and persistent graph memory architectures reduce inference latency and operational expenditure while preserving frontier-level reasoning quality.',
    rubric:
      '1. Formulate a clear, falsifiable thesis statement (25%). 2. Ground arguments in concrete empirical metrics and architectural mechanisms from the source documents (30%). 3. Address counterarguments regarding local hardware constraints and synchronization overhead (25%). 4. Maintain cohesive academic transitions across hierarchical sections (20%).'
  },
  {
    id: 'preset-biomimetic',
    label: 'Academic Essay: Biomimetic Web Crawling vs. Static RAG',
    docType: 'essay',
    prompt:
      'Critically compare biomimetic viewport-synchronized web crawling and structured Neural Graph indexing against conventional chunk-based vector RAG pipelines for long-form technical comprehension.',
    rubric:
      'Evaluate conceptual originality, precision of technical mechanisms, integration of quantitative benchmarks, and rigor of counterarguments.'
  },
  {
    id: 'preset-project',
    label: 'Project Proposal: Distributed Telemetry & Knowledge Pipeline',
    docType: 'project_plan',
    prompt:
      'Design an engineering architecture and implementation plan for a high-throughput telemetry and knowledge-graph indexing system capable of sustaining 100,000+ events/sec with sub-15ms p99 latency.',
    rubric:
      'Must include system thesis, architectural bottlenecks, quantitative SLAs, failure recovery counter-strategies, and phased execution milestones.'
  }
];

export const OutlineStudioPanel: React.FC<OutlineStudioPanelProps> = ({
  apiConfig,
  knowledgeBase,
  webpageTitle,
  webpageText,
  selectedText,
  uploadedDocs,
  onAddUploadedDoc,
  onRemoveUploadedDoc,
  onSaveInsightToGraph
}) => {
  const [documentType, setDocumentType] = useState<OutlineDocumentType>('research_paper');
  const [assignmentPrompt, setAssignmentPrompt] = useState<string>(ASSIGNMENT_PRESETS[0].prompt);
  const [rubricCriteria, setRubricCriteria] = useState<string>(ASSIGNMENT_PRESETS[0].rubric);
  const [includeWebpage, setIncludeWebpage] = useState<boolean>(true);
  const [includeNeuralGraph, setIncludeNeuralGraph] = useState<boolean>(true);

  // Document upload / paste state
  const [showDocInput, setShowDocInput] = useState<boolean>(false);
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const [newDocType, setNewDocType] = useState<UploadedDocument['docType']>('source');
  const [newDocContent, setNewDocContent] = useState<string>('');

  // Generated Outline & Draft state
  const [outline, setOutline] = useState<StructuredOutline | null>(null);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState<boolean>(false);
  const [activeSectionActionId, setActiveSectionActionId] = useState<string | null>(null);
  const [isGeneratingFullDraft, setIsGeneratingFullDraft] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [customRewritePrompt, setCustomRewritePrompt] = useState<Record<string, string>>({});

  // Retrieve relevant Neural Graph nodes based on assignment prompt + rubric
  const matchedNeurons: MemoryNeuron[] = useMemo(() => {
    if (!includeNeuralGraph) return [];
    return findRelevantNeurons(
      knowledgeBase,
      `${assignmentPrompt} ${rubricCriteria} ${selectedText}`,
      6
    );
  }, [knowledgeBase, assignmentPrompt, rubricCriteria, selectedText, includeNeuralGraph]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '').trim();
      if (content) {
        onAddUploadedDoc({
          title: file.name,
          content: content.slice(0, 12000),
          docType: 'source'
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddPastedDoc = () => {
    if (!newDocContent.trim()) return;
    onAddUploadedDoc({
      title: newDocTitle.trim() || `Research Source #${uploadedDocs.length + 1}`,
      content: newDocContent.trim(),
      docType: newDocType
    });
    setNewDocTitle('');
    setNewDocContent('');
    setShowDocInput(false);
  };

  const handleGenerateOutline = async () => {
    if (!assignmentPrompt.trim() || isGeneratingOutline) return;
    setErrorMsg(null);
    setIsGeneratingOutline(true);
    try {
      const generated = await generateStructuredOutline({
        assignmentPrompt: assignmentPrompt.trim(),
        rubricCriteria: rubricCriteria.trim(),
        documentType,
        webpageTitle: includeWebpage ? webpageTitle : 'Excluded',
        webpageText: includeWebpage ? webpageText : '',
        selectedText,
        uploadedDocs,
        relevantNeurons: matchedNeurons,
        apiConfig
      });
      setOutline(generated);
    } catch (err: any) {
      setErrorMsg(String(err?.message || 'Failed to generate outline.'));
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleSectionAiAction = async (
    section: OutlineSectionItem,
    action: 'expand' | 'shorten' | 'rewrite' | 'counterargument' | 'draft_section'
  ) => {
    if (!outline || activeSectionActionId) return;
    setErrorMsg(null);
    setActiveSectionActionId(`${section.id}:${action}`);
    try {
      const res = await transformOutlineSection({
        outlineTitle: outline.title,
        thesisStatement: outline.thesisStatement,
        section,
        action,
        customInstruction: customRewritePrompt[section.id] || '',
        webpageText: includeWebpage ? webpageText : '',
        relevantNeurons: matchedNeurons,
        apiConfig
      });
      setOutline((prev) =>
        prev
          ? {
              ...prev,
              sections: prev.sections.map((s) => (s.id === section.id ? res.section : s)),
              modelUsed: res.modelUsed || prev.modelUsed,
              updatedAt: Date.now()
            }
          : prev
      );
    } catch (err: any) {
      setErrorMsg(String(err?.message || 'Section transformation failed.'));
    } finally {
      setActiveSectionActionId(null);
    }
  };

  const handleMoveSection = (index: number, direction: -1 | 1) => {
    if (!outline) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= outline.sections.length) return;
    const nextSections = [...outline.sections];
    const [moved] = nextSections.splice(index, 1);
    nextSections.splice(targetIdx, 0, moved);
    setOutline({ ...outline, sections: nextSections, updatedAt: Date.now() });
  };

  const handleChangeLevel = (sectionId: string, delta: -1 | 1) => {
    if (!outline) return;
    setOutline({
      ...outline,
      sections: outline.sections.map((s) =>
        s.id === sectionId
          ? { ...s, level: Math.max(1, Math.min(3, s.level + delta)) as 1 | 2 | 3 }
          : s
      ),
      updatedAt: Date.now()
    });
  };

  const handleDeleteSection = (sectionId: string) => {
    if (!outline) return;
    setOutline({
      ...outline,
      sections: outline.sections.filter((s) => s.id !== sectionId),
      updatedAt: Date.now()
    });
  };

  const handleAddSectionBelow = (index: number) => {
    if (!outline) return;
    const newSec: OutlineSectionItem = {
      id: `sec-${Date.now()}`,
      heading: 'New Analytical Section: Core Claim & Mechanism',
      level: 1,
      coreArgument: 'State the specific claim or sub-thesis for this section.',
      supportingEvidence: ['Add empirical evidence, quote, or citation from sources.'],
      explanation: 'Explain how this evidence proves the section claim and advances the thesis.',
      counterargument: 'Identify a potential limitation or counterargument and your rebuttal.',
      sourceCitations: [webpageTitle]
    };
    const nextSections = [...outline.sections];
    nextSections.splice(index + 1, 0, newSec);
    setOutline({ ...outline, sections: nextSections, updatedAt: Date.now() });
    setEditingSectionId(newSec.id);
  };

  const handleUpdateSectionField = (
    sectionId: string,
    updates: Partial<OutlineSectionItem>
  ) => {
    if (!outline) return;
    setOutline({
      ...outline,
      sections: outline.sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
      updatedAt: Date.now()
    });
  };

  const handleGenerateFullDraft = async () => {
    if (!outline || isGeneratingFullDraft) return;
    setErrorMsg(null);
    setIsGeneratingFullDraft(true);
    try {
      const res = await generateFullDraftFromOutline({
        outline,
        webpageText: includeWebpage ? webpageText : '',
        uploadedDocs,
        relevantNeurons: matchedNeurons,
        apiConfig
      });
      setOutline((prev) =>
        prev
          ? {
              ...prev,
              fullDraft: res.fullDraft,
              modelUsed: res.modelUsed || prev.modelUsed,
              updatedAt: Date.now()
            }
          : prev
      );
    } catch (err: any) {
      setErrorMsg(String(err?.message || 'Failed to generate complete draft.'));
    } finally {
      setIsGeneratingFullDraft(false);
    }
  };

  const exportOutlineAsMarkdown = (): string => {
    if (!outline) return '';
    const sectionsMd = outline.sections
      .map((s, idx) => {
        const prefix = s.level === 1 ? '##' : s.level === 2 ? '###' : '####';
        return `${prefix} ${idx + 1}. ${s.heading}
- **Core Argument:** ${s.coreArgument}
- **Supporting Evidence:**
${s.supportingEvidence.map((ev) => `  - ${ev}`).join('\n')}
- **Analytical Explanation:** ${s.explanation}
${s.counterargument ? `- **Counterargument & Rebuttal:** ${s.counterargument}` : ''}
- **Citations:** ${s.sourceCitations.join(', ') || 'None'}
${s.draftContent ? `\n**Section Prose Draft:**\n${s.draftContent}\n` : ''}`;
      })
      .join('\n\n');

    return `# ${outline.title}
**Document Type:** ${outline.documentType.replace('_', ' ').toUpperCase()}
**Model Used:** ${outline.modelUsed}

## Thesis Statement
> ${outline.thesisStatement}

## Argument Architecture
${outline.argumentArchitecture}

---

${sectionsMd}
${outline.fullDraft ? `\n---\n\n# Complete Synthesized Draft\n\n${outline.fullDraft}` : ''}`;
  };

  const handleCopyMarkdown = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedBanner(label);
    setTimeout(() => setCopiedBanner(null), 2500);
  };

  return (
    <div className="space-y-6" data-testid="outline-studio-panel">
      {/* Top Configuration & Context Sources Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Assignment Prompt & Rubric Input */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[#090d15] border border-slate-800/90 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div>
              <div className="text-[10.5px] font-mono uppercase tracking-wider text-sky-400">
                Step 1 • Assignment, Prompt &amp; Rubric Analysis
              </div>
              <h3 className="text-sm font-bold text-white">
                Academic, Research &amp; Project Outlining Engine
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'research_paper', label: 'Research Paper' },
                  { id: 'essay', label: 'Academic Essay' },
                  { id: 'assignment', label: 'Assignment' },
                  { id: 'presentation', label: 'Presentation' },
                  { id: 'project_plan', label: 'Project Plan' }
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDocumentType(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                    documentType === t.id
                      ? 'bg-sky-500/20 text-sky-200 border-sky-400/50 font-semibold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preset Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-mono text-slate-400 mr-1">Templates:</span>
            {ASSIGNMENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setDocumentType(preset.docType);
                  setAssignmentPrompt(preset.prompt);
                  setRubricCriteria(preset.rubric);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="outline-assignment-prompt"
              className="block text-xs font-semibold text-slate-200"
            >
              Assignment Instructions / Research Question
            </label>
            <textarea
              id="outline-assignment-prompt"
              value={assignmentPrompt}
              onChange={(e) => setAssignmentPrompt(e.target.value)}
              rows={3}
              placeholder="Paste your essay prompt, research question, or project instructions..."
              className="w-full p-3 rounded-xl bg-[#06090f] border border-slate-800 focus:border-sky-400 focus:outline-none text-xs text-slate-100 leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="outline-rubric-input"
              className="block text-xs font-semibold text-slate-200"
            >
              Grading Rubric / Evaluation Criteria &amp; Constraints
            </label>
            <textarea
              id="outline-rubric-input"
              value={rubricCriteria}
              onChange={(e) => setRubricCriteria(e.target.value)}
              rows={2}
              placeholder="Optional: Paste grading rubric criteria, required sections, citation style, or word count targets..."
              className="w-full p-2.5 rounded-xl bg-[#06090f] border border-slate-800 focus:border-sky-400 focus:outline-none text-xs text-slate-200 leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeWebpage}
                  onChange={(e) => setIncludeWebpage(e.target.checked)}
                  className="rounded accent-sky-400"
                />
                <span>Ground in Active Webpage</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeNeuralGraph}
                  onChange={(e) => setIncludeNeuralGraph(e.target.checked)}
                  className="rounded accent-purple-400"
                />
                <span>Retrieve Neural Graph ({matchedNeurons.length} matched)</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleGenerateOutline}
              disabled={isGeneratingOutline || !assignmentPrompt.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-md"
            >
              {isGeneratingOutline ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing Rubric &amp; Building Outline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Structured Outline</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Active Context Bundle (Webpage, Selection, Uploaded Docs, Neural Graph) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#090d15] border border-slate-800/90 space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
            <div>
              <div className="text-[10.5px] font-mono uppercase tracking-wider text-purple-400">
                Step 2 • Grounding Sources &amp; Memory
              </div>
              <h3 className="text-sm font-bold text-white">
                Active Context &amp; Uploaded Documents
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 cursor-pointer">
                <Upload className="w-3 h-3 text-sky-400" />
                <span>Upload .txt/.md</span>
                <input
                  type="file"
                  accept=".txt,.md,.json,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowDocInput((s) => !s)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-[11px] text-purple-200 font-medium cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Paste Source</span>
              </button>
            </div>
          </div>

          {showDocInput && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Document Title (e.g., Lecture Notes, Source Paper)"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#06090f] border border-slate-800 text-xs text-white"
                />
                <select
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value as UploadedDocument['docType'])}
                  aria-label="Uploaded document type"
                  className="px-2 py-1.5 rounded-lg bg-[#06090f] border border-slate-800 text-xs text-slate-200"
                >
                  <option value="source">Source Reading</option>
                  <option value="assignment">Assignment Spec</option>
                  <option value="rubric">Grading Rubric</option>
                  <option value="notes">Research Notes</option>
                </select>
              </div>
              <textarea
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                rows={3}
                placeholder="Paste source document text, rubric details, or research notes..."
                className="w-full p-2.5 rounded-lg bg-[#06090f] border border-slate-800 text-xs text-slate-200"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocInput(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddPastedDoc}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs cursor-pointer"
                >
                  Add Document to Context
                </button>
              </div>
            </div>
          )}

          {/* Selected Webpage Excerpt */}
          {selectedText && (
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/30 space-y-1">
              <div className="text-[10px] font-mono uppercase text-sky-300 font-semibold">
                Selected Webpage Excerpt (Active)
              </div>
              <p className="text-[11px] text-slate-200 line-clamp-2">&ldquo;{selectedText}&rdquo;</p>
            </div>
          )}

          {/* Uploaded Documents List */}
          <div className="space-y-1.5">
            <div className="text-[10.5px] font-mono text-slate-400">
              Uploaded Documents ({uploadedDocs.length})
            </div>
            {uploadedDocs.length === 0 ? (
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400">
                No external documents uploaded yet. Upload a `.txt`/`.md` file or click &ldquo;Paste Source&rdquo; to attach readings or rubrics.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {uploadedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="text-slate-200 font-medium truncate">{doc.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">
                        {doc.docType} • {doc.wordCount}w
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveUploadedDoc(doc.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      aria-label={`Remove document ${doc.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Retrieved Neural Graph Nodes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px] font-mono text-purple-300">
              <span className="flex items-center gap-1">
                <Network className="w-3 h-3" />
                <span>Relevant Neural Graph Nodes Retrieved ({matchedNeurons.length})</span>
              </span>
            </div>
            {matchedNeurons.length === 0 ? (
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-500">
                No Neural Graph nodes matched the current prompt above the relevance threshold.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {matchedNeurons.map((n) => (
                  <span
                    key={n.id}
                    className="text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-200 border border-purple-400/30"
                    title={n.distilledInsight}
                  >
                    [[{n.title.slice(0, 28)}]]
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-400/40 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-[11px] font-mono underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {copiedBanner && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{copiedBanner}</span>
        </div>
      )}

      {/* Structured Outline Workspace */}
      {outline && (
        <div className="space-y-5" data-testid="generated-outline-workspace">
          {/* Thesis & Assignment Analysis Header Card */}
          <div className="p-5 rounded-2xl bg-[#090d15] border border-slate-800/90 space-y-4">
            <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-800/80">
              <div className="space-y-1.5 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-400/30">
                    {outline.documentType.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-300 border border-slate-800">
                    Model: {outline.modelUsed}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    {outline.sections.length} Structured Sections
                  </span>
                </div>
                <input
                  type="text"
                  value={outline.title}
                  onChange={(e) => setOutline({ ...outline, title: e.target.value })}
                  aria-label="Outline Document Title"
                  className="w-full text-base md:text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-sky-400 focus:outline-none py-0.5"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSaveInsightToGraph(
                      `Thesis: ${outline.thesisStatement} Architecture: ${outline.argumentArchitecture}`,
                      `Outline Thesis: ${outline.title.slice(0, 32)}`
                    );
                    handleCopyMarkdown(outline.thesisStatement, 'Saved Thesis as a Neural Graph Node!');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-400/40 text-purple-200 text-xs font-medium cursor-pointer"
                >
                  <Network className="w-3.5 h-3.5 text-purple-400" />
                  <span>Save Thesis to Graph</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyMarkdown(
                      exportOutlineAsMarkdown(),
                      'Copied full Markdown Outline to clipboard!'
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>Copy Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateFullDraft}
                  disabled={isGeneratingFullDraft}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {isGeneratingFullDraft ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Writing Complete Draft...</span>
                    </>
                  ) : (
                    <>
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Convert Outline to Complete Draft</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Assignment & Rubric Breakdown */}
            {outline.assignmentAnalysis && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-sky-400 font-semibold">
                    Core Assignment Objective
                  </div>
                  <p className="text-slate-200 leading-relaxed">
                    {outline.assignmentAnalysis.coreObjective}
                  </p>
                  <div className="text-[10px] font-mono text-slate-400 pt-1">
                    Audience: {outline.assignmentAnalysis.toneAndAudience}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-emerald-400 font-semibold">
                    Key Deliverable Requirements
                  </div>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {(outline.assignmentAnalysis.keyRequirements || []).map((req, i) => (
                      <li key={i} className="leading-snug">
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-amber-400 font-semibold">
                    Rubric Alignment Priorities
                  </div>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {(outline.assignmentAnalysis.rubricPriorities || []).map((rub, i) => (
                      <li key={i} className="leading-snug">
                        {rub}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Editable Thesis Statement & Argument Architecture */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-7 p-3.5 rounded-xl bg-sky-500/10 border border-sky-400/35 space-y-1.5">
                <label
                  htmlFor="editable-thesis-statement"
                  className="block text-[10px] font-mono uppercase text-sky-300 font-bold"
                >
                  Central Thesis Statement (Editable)
                </label>
                <textarea
                  id="editable-thesis-statement"
                  value={outline.thesisStatement}
                  onChange={(e) => setOutline({ ...outline, thesisStatement: e.target.value })}
                  rows={2}
                  className="w-full bg-transparent text-xs md:text-sm font-medium text-white focus:outline-none leading-relaxed"
                />
              </div>

              <div className="md:col-span-5 p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label
                  htmlFor="editable-argument-arch"
                  className="block text-[10px] font-mono uppercase text-purple-300 font-bold"
                >
                  Coherent Argument Structure
                </label>
                <textarea
                  id="editable-argument-arch"
                  value={outline.argumentArchitecture}
                  onChange={(e) => setOutline({ ...outline, argumentArchitecture: e.target.value })}
                  rows={2}
                  className="w-full bg-transparent text-xs text-slate-200 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Hierarchical Editable Outline Sections */}
          <div className="space-y-3.5">
            {outline.sections.map((section, idx) => {
              const isEditing = editingSectionId === section.id;
              const indentClass =
                section.level === 2
                  ? 'ml-4 md:ml-8 border-l-2 border-l-sky-500/40'
                  : section.level === 3
                  ? 'ml-8 md:ml-14 border-l-2 border-l-purple-500/40'
                  : '';

              return (
                <div
                  key={section.id}
                  className={`p-4 rounded-2xl bg-[#090d15] border border-slate-800/90 space-y-3 transition-all ${indentClass}`}
                >
                  {/* Section Header & Reorganization Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-sky-300">
                        H{section.level} • §{idx + 1}
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={section.heading}
                          onChange={(e) =>
                            handleUpdateSectionField(section.id, { heading: e.target.value })
                          }
                          aria-label={`Section ${idx + 1} heading`}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-sky-400 text-xs font-bold text-white"
                        />
                      ) : (
                        <h4 className="text-sm font-bold text-white leading-snug">
                          {section.heading}
                        </h4>
                      )}
                    </div>

                    {/* Section Controls: Reorder, Indent, Edit, AI Actions */}
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 cursor-pointer"
                        title="Move Section Up"
                        aria-label={`Move section ${idx + 1} up`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, 1)}
                        disabled={idx === outline.sections.length - 1}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 cursor-pointer"
                        title="Move Section Down"
                        aria-label={`Move section ${idx + 1} down`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeLevel(section.id, -1)}
                        disabled={section.level <= 1}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 cursor-pointer"
                        title="Outdent Section Level"
                        aria-label={`Outdent section ${idx + 1}`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeLevel(section.id, 1)}
                        disabled={section.level >= 3}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 cursor-pointer"
                        title="Indent as Subsection"
                        aria-label={`Indent section ${idx + 1}`}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditingSectionId(isEditing ? null : section.id)
                        }
                        className={`px-2 py-1 rounded text-[10.5px] font-mono border cursor-pointer ${
                          isEditing
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        {isEditing ? 'Done Editing' : 'Edit Fields'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSectionAiAction(section, 'expand')}
                        disabled={Boolean(activeSectionActionId)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-[10.5px] font-medium cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>
                          {activeSectionActionId === `${section.id}:expand`
                            ? 'Expanding...'
                            : 'Expand'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSectionAiAction(section, 'shorten')}
                        disabled={Boolean(activeSectionActionId)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10.5px] font-medium cursor-pointer"
                      >
                        <Minimize2 className="w-3 h-3" />
                        <span>
                          {activeSectionActionId === `${section.id}:shorten`
                            ? 'Tightening...'
                            : 'Shorten'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSectionAiAction(section, 'draft_section')}
                        disabled={Boolean(activeSectionActionId)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10.5px] font-semibold cursor-pointer"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>
                          {activeSectionActionId === `${section.id}:draft_section`
                            ? 'Drafting...'
                            : 'Draft Prose'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddSectionBelow(idx)}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-sky-300 cursor-pointer"
                        title="Add Section Below"
                        aria-label={`Add section below section ${idx + 1}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSection(section.id)}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-rose-400 cursor-pointer"
                        title="Delete Section"
                        aria-label={`Delete section ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Section Content Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Logical Claim & Explanation */}
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1">
                        <div className="text-[10px] font-mono uppercase text-sky-400 font-semibold">
                          Logical Argument &amp; Claim
                        </div>
                        {isEditing ? (
                          <textarea
                            value={section.coreArgument}
                            onChange={(e) =>
                              handleUpdateSectionField(section.id, {
                                coreArgument: e.target.value
                              })
                            }
                            rows={2}
                            className="w-full p-2 rounded bg-[#06090f] border border-slate-700 text-xs text-white"
                          />
                        ) : (
                          <p className="text-slate-100 leading-relaxed font-medium">
                            {section.coreArgument}
                          </p>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1">
                        <div className="text-[10px] font-mono uppercase text-emerald-400 font-semibold">
                          Analytical Explanation (How Evidence Proves Claim)
                        </div>
                        {isEditing ? (
                          <textarea
                            value={section.explanation}
                            onChange={(e) =>
                              handleUpdateSectionField(section.id, {
                                explanation: e.target.value
                              })
                            }
                            rows={3}
                            className="w-full p-2 rounded bg-[#06090f] border border-slate-700 text-xs text-slate-200"
                          />
                        ) : (
                          <p className="text-slate-300 leading-relaxed">{section.explanation}</p>
                        )}
                      </div>
                    </div>

                    {/* Supporting Evidence & Counterargument */}
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-1.5">
                        <div className="text-[10px] font-mono uppercase text-purple-300 font-semibold">
                          Supporting Evidence &amp; Metrics
                        </div>
                        {isEditing ? (
                          <textarea
                            value={section.supportingEvidence.join('\n')}
                            onChange={(e) =>
                              handleUpdateSectionField(section.id, {
                                supportingEvidence: e.target.value
                                  .split('\n')
                                  .map((s) => s.trim())
                                  .filter(Boolean)
                              })
                            }
                            rows={3}
                            placeholder="One evidence point per line..."
                            className="w-full p-2 rounded bg-[#06090f] border border-slate-700 text-xs text-slate-200"
                          />
                        ) : (
                          <ul className="space-y-1 text-slate-200 list-disc list-inside">
                            {section.supportingEvidence.map((ev, evIdx) => (
                              <li key={evIdx} className="leading-relaxed">
                                {ev}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/25 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-amber-300 font-semibold">
                            Counterargument &amp; Rebuttal
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSectionAiAction(section, 'counterargument')}
                            disabled={Boolean(activeSectionActionId)}
                            className="text-[10px] font-mono text-amber-300 hover:text-amber-200 underline cursor-pointer"
                          >
                            {activeSectionActionId === `${section.id}:counterargument`
                              ? 'Strengthening...'
                              : 'Strengthen Rebuttal'}
                          </button>
                        </div>
                        {isEditing ? (
                          <textarea
                            value={section.counterargument || ''}
                            onChange={(e) =>
                              handleUpdateSectionField(section.id, {
                                counterargument: e.target.value
                              })
                            }
                            rows={2}
                            className="w-full p-2 rounded bg-[#06090f] border border-slate-700 text-xs text-slate-200"
                          />
                        ) : (
                          <p className="text-slate-300 leading-relaxed">
                            {section.counterargument || 'No counterargument specified.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Custom Rewrite Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">Citations:</span>
                      {(section.sourceCitations || []).map((cit, cIdx) => (
                        <span
                          key={cIdx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-sky-300 border border-slate-800"
                        >
                          {cit}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 flex-1 max-w-md">
                      <input
                        type="text"
                        value={customRewritePrompt[section.id] || ''}
                        onChange={(e) =>
                          setCustomRewritePrompt((prev) => ({
                            ...prev,
                            [section.id]: e.target.value
                          }))
                        }
                        placeholder="Custom rewrite instruction (e.g., focus on cost metrics)..."
                        className="flex-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleSectionAiAction(section, 'rewrite')}
                        disabled={Boolean(activeSectionActionId)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-mono cursor-pointer"
                      >
                        {activeSectionActionId === `${section.id}:rewrite`
                          ? 'Rewriting...'
                          : 'AI Rewrite'}
                      </button>
                    </div>
                  </div>

                  {/* Generated Section Prose Draft (if drafted) */}
                  {section.draftContent && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-400/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-emerald-300 font-bold">
                          Generated Section Prose Draft
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyMarkdown(
                              section.draftContent || '',
                              `Copied prose draft for "${section.heading}"!`
                            )
                          }
                          className="text-[10px] font-mono text-emerald-300 hover:text-white cursor-pointer"
                        >
                          Copy Section Prose
                        </button>
                      </div>
                      <textarea
                        value={section.draftContent}
                        onChange={(e) =>
                          handleUpdateSectionField(section.id, { draftContent: e.target.value })
                        }
                        rows={5}
                        className="w-full bg-transparent text-xs text-slate-100 leading-relaxed focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Complete Converted Draft Card */}
          {outline.fullDraft && (
            <div
              className="p-5 rounded-2xl bg-[#090d15] border border-emerald-500/40 space-y-3"
              data-testid="complete-outline-draft"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Complete Cohesive Draft ({outline.title})
                    </h3>
                    <div className="text-[10.5px] font-mono text-emerald-300">
                      Synthesized from Structured Outline • Preserves Thesis, Evidence &amp; Counterarguments
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyMarkdown(
                        outline.fullDraft || '',
                        'Copied complete draft to clipboard!'
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full Draft</span>
                  </button>
                </div>
              </div>

              <textarea
                value={outline.fullDraft}
                onChange={(e) => setOutline({ ...outline, fullDraft: e.target.value })}
                rows={16}
                aria-label="Complete generated draft"
                className="w-full p-4 rounded-xl bg-[#06090f] border border-slate-800 text-xs md:text-sm text-slate-100 leading-relaxed font-sans focus:border-emerald-400 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
