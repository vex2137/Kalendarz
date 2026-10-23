import { runModelAssistant } from '../src/utils/modelAssistant';
import { DEFAULT_PLANNING } from '../src/utils/assistantPlanning';
import * as runtime from '../src/utils/localModelRuntime';
import { calendarSystemPrompt, commandSchemaForRequest, parseModelCommand, resolveModelCommand } from '../src/utils/modelCommand';
import { diagnosticsReport } from '../src/utils/modelDiagnostics';
Object.assign(window, { calendarEvaluation: { runModelAssistant, DEFAULT_PLANNING, runtime, calendarSystemPrompt, commandSchemaForRequest, parseModelCommand, resolveModelCommand, diagnosticsReport } });
