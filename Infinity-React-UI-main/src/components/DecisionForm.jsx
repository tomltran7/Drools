import React, { useState, useEffect } from 'react';
import { droolsApi } from '../services/droolsApi';

// Render form fields recursively from the schema returned by backend
function FieldRenderer({ schema, value, onChange, path = [] }) {
  // schema: { type: 'tData' | 'string' | ..., fields?: [...] }
  if (!schema) return null;

  if (schema.fields && Array.isArray(schema.fields)) {
    // complex object
    return (
      <div className="space-y-3 border p-3 rounded">
        {schema.fields.map((f) => (
          <div key={f.name}>
            <label className="block text-sm font-medium">{f.name}</label>
            <FieldRenderer
              schema={f.schema || { type: f.type }}
              value={value ? value[f.name] : undefined}
              onChange={(v) => onChange({ ...(value || {}), [f.name]: v })}
              path={[...path, f.name]}
            />
          </div>
        ))}
      </div>
    );
  }

  // primitive or collection
  const t = schema.type || 'string';
  // If caller expects a collection, render as comma-separated input
  if (schema.isCollection || t.startsWith('List') || t.toLowerCase().includes('[]')) {
    const strVal = Array.isArray(value) ? value.join(',') : (value || '');
    return (
      <input
        className="border p-2 rounded w-full"
        value={strVal}
        onChange={(e) => onChange(e.target.value ? e.target.value.split(',').map(s => s.trim()) : [])}
      />
    );
  }

  // simple scalar
  return (
    <input
      className="border p-2 rounded w-full"
      value={value == null ? '' : value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function DecisionForm() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [schema, setSchema] = useState(null);
  const [formData, setFormData] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function loadModels() {
      try {
        const res = await droolsApi.listModels();
        setModels(res);
        // default to quickwins if present, otherwise first model
        const qm = res.find(m => m.name && m.name.toLowerCase() === 'quickwins');
        if (qm) setSelectedModel(qm);
        else if (res.length > 0) setSelectedModel(res[0]);
      } catch (e) {
        console.error('Failed to load DMN models', e);
      }
    }
    loadModels();
  }, []);

  useEffect(() => {
    async function loadSchema() {
      if (!selectedModel) return;
      try {
        const s = await droolsApi.getModelSchema(selectedModel.name);
        setSchema(s);
        // initialize empty top-level inputs
        const initial = {};
        (s.inputs || []).forEach(inp => {
          initial[inp.name] = {};
        });
        setFormData(initial);
      } catch (e) {
        console.error('Failed to load schema', e);
      }
    }
    loadSchema();
  }, [selectedModel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // formData already shaped like { Data: { Claim: {...}, Line: {...} } }
      const payload = formData;
      const res = await droolsApi.evaluateDecision(payload);
      setResult(res);
    } catch (err) {
      console.error(err);
      alert('Error contacting backend');
    }
  };

  if (!selectedModel) return <div className="p-6">Loading DMN model info...</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Authorization Decision</h2>

      {!schema && <div>Loading model schema...</div>}

      {schema && (
        <div>
          <div className="mb-3">
            <label className="block text-sm font-medium">Select DMN Model</label>
            <select
              className="border p-2 rounded w-full"
              value={selectedModel ? selectedModel.name : ''}
              onChange={(e) => {
                const name = e.target.value;
                const m = models.find(x => x.name === name);
                setSelectedModel(m || null);
                setSchema(null);
                setFormData({});
                setResult(null);
              }}
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {schema.inputs.map((inp) => (
              <div key={inp.name}>
                <h3 className="font-semibold">{inp.name} ({inp.type})</h3>
                <FieldRenderer
                  schema={inp.schema}
                  value={formData[inp.name]}
                  onChange={(v) => setFormData(prev => ({ ...prev, [inp.name]: v }))}
                />
              </div>
            ))}

            <div className="flex items-center gap-3">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Evaluate</button>

              {/* Presets for common test cases (only shown if model has presets) */}
              {selectedModel && selectedModel.name && (
                <PresetButtons modelName={selectedModel.name} onApply={(p) => setFormData(p)} />
              )}
            </div>
          </form>
        </div>
      )}

      {result && (
        <pre className="mt-4 p-3 bg-gray-100 border rounded">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}

function PresetButtons({ modelName, onApply }) {
  // Define a couple of sample presets for known model 'quickwins'
  const presets = [];
  if (modelName && modelName.toLowerCase() === 'quickwins') {
    presets.push({
      name: 'Preset: Authorization Y',
      payload: {
        Data: {
          Claim: { companyCode: '01', claimType: 'I' },
          Line: { authorizationIndicator: 'Y', preAuthorizationPassIndicator: 'N', modifierCode: ['26'], procedureCode: '12345', businessLabel: ['A'] }
        }
      }
    });
    presets.push({
      name: 'Preset: Authorization N (different proc)',
      payload: {
        Data: {
          Claim: { companyCode: '02', claimType: 'P' },
          Line: { authorizationIndicator: 'N', preAuthorizationPassIndicator: 'Y', modifierCode: [], procedureCode: '99999', businessLabel: ['B'] }
        }
      }
    });
  }

  if (presets.length === 0) return null;

  return (
    <div className="flex gap-2">
      {presets.map(p => (
        <button
          key={p.name}
          type="button"
          className="bg-gray-200 px-3 py-1 rounded"
          onClick={() => onApply(p.payload)}
        >{p.name}</button>
      ))}
    </div>
  );
}
