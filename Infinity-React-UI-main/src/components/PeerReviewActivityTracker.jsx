import React, { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { LogOut, Play, RefreshCw, CheckCircle, XCircle, MessageSquare, GitPullRequest, Users, Clock } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

// Mock data
const MOCK_REPOSITORIES = [
  { id: 'r1', name: 'Authorization_CSBD_DMN' },
  { id: 'r2', name: 'Authorization_GBD_DMN' },
  { id: 'r3', name: 'Deny' },
];
const MOCK_RUNS = [
  { id: 'r1', status: 'SUCCESS', startTime: Date.now() - 1000 * 60 * 60, endTime: Date.now() - 1000 * 60 * 30, pipelineName: 'Authorization_CSBD_DMN', needsReview: false, reviewStatus: 'approved', reviewer: 'alice@company.com' },
  { id: 'r2', status: 'FAILED', startTime: Date.now() - 1000 * 60 * 120, endTime: Date.now() - 1000 * 60 * 110, pipelineName: 'Authorization_GBD_DMN', needsReview: false, reviewStatus: null, reviewer: null },
  { id: 'r3', status: 'STARTED', startTime: Date.now() - 1000 * 60 * 5, endTime: null, pipelineName: 'Deny', needsReview: true, reviewStatus: null, reviewer: null },
];
const MOCK_SCHEDULES = [
  { name: 'daily', cronSchedule: '0 0 * * *', pipelineName: 'Authorization_CSBD_DMN', isStopped: false },
  { name: 'weekly', cronSchedule: '0 0 * * 0', pipelineName: 'Authorization_GBD_DMN', isStopped: true },
  { name: 'monthly', cronSchedule: '0 0 1 * *', pipelineName: 'Deny', isStopped: false },
  { name: 'hourly', cronSchedule: '0 * * * *', pipelineName: 'Authorization_CSBD_DMN', isStopped: false },
];

export default function PeerReviewActivityTracker() {
  // State
  const [repositories, setRepositories] = useState(MOCK_REPOSITORIES);
  const [runs, setRuns] = useState(MOCK_RUNS);
  const [schedules, setSchedules] = useState(MOCK_SCHEDULES);
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterText, setFilterText] = useState('');
  const [reviewFeedback, setReviewFeedback] = useState({});
  const [pendingReviews, setPendingReviews] = useState(MOCK_RUNS.filter(r => r.needsReview && !r.reviewStatus));
  const [logs, setLogs] = useState([]);
  const logsAutoScrollRef = useRef(true);
  const [error, setError] = useState(null);

  // Derived filtered runs
  const filteredRuns = runs.filter(r => {
    const statusMatch = filterStatus ? r.status === filterStatus : true;
    const search = (filterText || '').trim().toLowerCase();
    const textMatch = !search || (r.id && r.id.toLowerCase().includes(search)) || (r.pipelineName && r.pipelineName.toLowerCase().includes(search));
    return statusMatch && textMatch;
  });
  const chartData = filteredRuns.map(r => ({ name: r.pipelineName, duration: r.endTime ? Math.max(0, (r.endTime - r.startTime) / 1000) : (Date.now() - r.startTime) / 1000 }));

  // Status badge helper
  function humanStatusBadge(status) {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';
    if (status === 'SUCCESS') return <span className={`${base} bg-green-100 text-green-800`}>Success</span>;
    if (status === 'FAILED') return <span className={`${base} bg-red-100 text-red-800`}>Failed</span>;
    if (status === 'STARTED' || status === 'STARTING') return <span className={`${base} bg-yellow-100 text-yellow-800`}>Running</span>;
    return <span className={`${base} bg-gray-100 text-gray-800`}>{status}</span>;
  }
  function reviewStatusBadge(run) {
    if (!run.needsReview) return null;
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ml-2';
    if (run.reviewStatus === 'approved') return <span className={`${base} bg-green-100 text-green-800`}>✓ Approved</span>;
    if (run.reviewStatus === 'denied') return <span className={`${base} bg-red-100 text-red-800`}>✗ Denied</span>;
    return <span className={`${base} bg-blue-100 text-blue-800`}>Pending Review</span>;
  }
  function handleReviewAction(runId, action, feedback = '') {
    const updatedRuns = runs.map(run => {
      if (run.id === runId) {
        return {
          ...run,
          reviewStatus: action,
          reviewer: 'current-user@company.com',
          reviewFeedback: feedback,
          reviewedAt: Date.now()
        };
      }
      return run;
    });
    setRuns(updatedRuns);
    setPendingReviews(prev => prev.filter(r => r.id !== runId));
    setReviewFeedback(prev => ({ ...prev, [runId]: '' }));
    setError(`Run ${runId} ${action} successfully`);
  }

  return (
    <div className="p-6 min-h-screen bg-slate-50">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Peer Review Activity Tracker</h1>
          <p className="text-sm text-muted-foreground">Overview of pipelines, runs, schedules, reviews and logs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="flex items-center gap-2" onClick={() => window.location.reload()}>
            <RefreshCw size={16} className="mr-1" /> <span>Refresh</span>
          </Button>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-6">
        {/* Repositories, Schedules */}
        <section className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Repositories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {repositories.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-md hover:bg-slate-100">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-gray-500">id: {r.id}</div>
                    </div>
                    <div className="flex flex-row gap-2 min-w-[80px]">
                      <Button size="sm" className="w-full flex items-center justify-center gap-2" onClick={() => {setSelectedRepository(r); setSelectedRun(null); }}>
                        <Play size={14} className="mr-1" /> <span>Select</span>
                      </Button>
                      <Button size="sm" className="w-full flex items-center justify-center gap-2" onClick={() => {}}>
                        <Play size={14} className="mr-1" /> <span>Run</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {schedules.length === 0 && <div className="text-xs text-gray-500">No schedules found.</div>}
                {schedules.map(s => (
                  <div key={s.name} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.pipelineName} • {s.cronSchedule || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm">{s.isStopped ? 'Paused' : 'Active'}</label>
                      <input type="checkbox" checked={!s.isStopped} onChange={(e) => {}} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Runs, Run Durations, Selected Pipeline */}
        <section className="col-span-6">
          <div className="flex items-center gap-3 mb-3">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="p-2 border rounded">
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="STARTED">Running</option>
            </select>
            <input className="p-2 border rounded flex-1" placeholder="Filter by run id or pipeline" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
            <Button onClick={() => { setFilterStatus(''); setFilterText(''); }}>Clear</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-96">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="p-2">Model</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Started</th>
                      <th className="p-2">Duration</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRuns.map(r => (
                      <tr key={r.id} className="border-b hover:bg-slate-50">
                        <td className="p-2">
                          <div className="flex items-center">
                            {r.pipelineName}
                            {reviewStatusBadge(r)}
                          </div>
                        </td>
                        <td className="p-2">{humanStatusBadge(r.status)}</td>
                        <td className="p-2">{r.startTime ? new Date(r.startTime).toLocaleString() : '-'}</td>
                        <td className="p-2">{r.endTime ? `${Math.round((r.endTime - r.startTime) / 1000)}s` : '—'}</td>
                        <td className="p-2 flex gap-2">
                          <Button size="sm" className="flex items-center gap-2" onClick={() => { setSelectedRun(r); }}>
                            <Clock size={14} className="mr-1" /> <span>Logs</span>
                          </Button>
                          <Button size="sm" className="flex items-center gap-2" onClick={() => alert(`Open run ${r.id} in Dagit (if configured)`)}>
                            <GitPullRequest size={14} className="mr-1" /> <span>Open</span>
                          </Button>
                          {r.status === 'FAILED' && <Button size="sm" className="flex items-center gap-2" onClick={() => {}}><RefreshCw size={14} className="mr-1" /> <span>Retry</span></Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Run Durations (seconds)</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="duration" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Peer Reviews, Live Logs, Error */}
        <section className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare size={20} /> Peer Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingReviews.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">No pending reviews</div>
                ) : (
                  pendingReviews.map(run => (
                    <div key={run.id} className="border rounded-lg p-3 bg-blue-50">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm">{run.pipelineName}</div>
                          <div className="text-xs text-gray-500">Run ID: {run.id}</div>
                        </div>
                        <div className="text-xs text-blue-600">{humanStatusBadge(run.status)}</div>
                      </div>
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Review Feedback</label>
                        <textarea
                          placeholder="Add your review comments..."
                          className="w-full p-2 text-xs border rounded resize-none"
                          rows={3}
                          value={reviewFeedback[run.id] || ''}
                          onChange={(e) => setReviewFeedback(prev => ({ ...prev, [run.id]: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2" onClick={() => handleReviewAction(run.id, 'approved', reviewFeedback[run.id])}>
                          <CheckCircle size={14} className="mr-1" /> <span>Approve</span>
                        </Button>
                        <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2" onClick={() => handleReviewAction(run.id, 'denied', reviewFeedback[run.id])}>
                          <XCircle size={14} className="mr-1" /> <span>Deny</span>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Review History */}
              <div className="mt-6 pt-4 border-t">
                <div className="text-sm font-medium mb-3">Recent Reviews</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {runs.filter(r => r.reviewStatus).slice(0, 5).map(run => (
                    <div key={run.id} className="p-2 border rounded text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{run.pipelineName}</span>
                        <span className={run.reviewStatus === 'approved' ? 'text-green-600' : 'text-red-600'}>
                          {run.reviewStatus === 'approved' ? '✓Approved' : '✗ Denied'}
                        </span>
                      </div>
                      <div className="text-gray-500">by {run.reviewer} • {run.reviewedAt ? new Date(run.reviewedAt).toLocaleDateString() : 'Unknown'}</div>
                      {run.reviewFeedback && (
                        <div className="mt-1 p-1 bg-gray-50 rounded text-gray-700">"{run.reviewFeedback}"</div>
                      )}
                    </div>
                  ))}
                  {/* Additional static Recent Review entry for demonstration */}
                  <div className="p-2 border rounded text-xs bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">Authorization_GBD_DMN</span>
                      <span className="text-green-600">✓Approved</span>
                    </div>
                    <div className="text-gray-500">by jane.smith@company.com • 9/28/2025</div>
                    <div className="mt-1 p-1 bg-gray-50 rounded text-gray-700">"Reviewed and approved for deployment."</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Button onClick={() => { alert('Open sensors view (not implemented in mock)'); }}>View Sensors</Button>
                <Button onClick={() => { alert('Open workspace'); }}>Open Workspace</Button>
              </div>
            </CardContent>
          </Card>

          {/* Live Logs removed from main grid; now only in second grid below */}

          {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md shadow">Error: {String(error)}</div>}
        </section>
      </main>

      {/* Second grid with one column for Live Logs */}
      <div className="grid grid-cols-1 gap-6 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Live Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm">Selected run:</div>
              <div className="font-medium">{selectedRun ? selectedRun.id : '—'}</div>
              <Button className="flex items-center gap-2" onClick={() => { setSelectedRun(null); setLogs([]); }}><RefreshCw size={14} className="mr-1" /> <span>Clear</span></Button>
            </div>
            <div id="run-logs-scroll-2" style={{ maxHeight: 320, overflow: 'auto', background: '#0f172a', color: '#e6eef8', padding: 8, borderRadius: 6 }}>
              {logs.length === 0 && <div className="text-xs text-gray-400">No logs yet.</div>}
              {logs.map((m, i) => (
                <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 6 }}>[{m.level || 'INFO'}] {m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ''} — {m.text}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-8 text-xs text-gray-500">Peer review dashboard — mock data only.</footer>
    </div>
  );
}
