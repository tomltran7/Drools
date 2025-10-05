import React from 'react';

const PRS = [
  {
    title: 'Added New Auth Indicator',
    status: 'Open',
    author: 'Tom Tran',
    repo: 'Authorization CSBD',
    updated: '2 hours ago',
    labels: ['feature'],
  },
  {
    title: 'Updated Rule 1 - Review Authorization Case Type',
    status: 'Closed',
    author: 'Jane Smith',
    repo: 'Authorization GBD',
    updated: '5 hours ago',
    labels: ['ui', 'design'],
  },
  {
    title: 'Updated Bypass Node',
    status: 'Open',
    author: 'John Doe',
    repo: 'Deny',
    updated: '1 day ago',
    labels: ['bug'],
  },
];

const PeerReview = () => {
  const [tab, setTab] = React.useState('Open');
  const [search, setSearch] = React.useState('');
  const [showReassignIdx, setShowReassignIdx] = React.useState(null);
  const [showBulkReassign, setShowBulkReassign] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState('');
  const [checked, setChecked] = React.useState(Array(PRS.length).fill(false));
  const userList = ['alice', 'bob', 'carol', 'dave', 'eve'];

  const [assignedTo, setAssignedTo] = React.useState(Array(PRS.length).fill('Unassigned'));
  const filteredPRs = PRS.filter(pr =>
    (tab === pr.status) &&
    (pr.title.toLowerCase().includes(search.toLowerCase()) ||
      pr.author.toLowerCase().includes(search.toLowerCase()) ||
      pr.repo.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Peer Review Request(s)</h1>
        <div className="relative">
            <button
              className="px-4 py-2 bg-blue-200 text-blue-800 rounded font-medium shadow hover:bg-blue-300"
              onClick={() => setShowBulkReassign(true)}
              disabled={!checked.some(Boolean)}
            >
              Reassign
            </button>
          {showBulkReassign && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-10">
              <div className="p-2 border-b font-semibold text-gray-700">Select user to reassign:</div>
              <ul>
                {userList.map((user) => (
                  <li key={user}>
                    <button
                      className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${selectedUser === user ? 'bg-blue-100 font-semibold' : ''}`}
                      onClick={() => {
                        setSelectedUser(user);
                        setShowBulkReassign(false);
                        // Assign selected user to checked PRs
                        setAssignedTo(prev => {
                          const updated = [...prev];
                          checked.forEach((isChecked, idx) => {
                            if (isChecked) updated[idx] = user;
                          });
                          return updated;
                        });
                        setChecked(Array(PRS.length).fill(false));
                      }}
                    >
                      {user}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b mb-4">
        {['Open', 'Closed'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 px-4 -mb-px border-b-2 font-medium text-sm focus:outline-none ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
          >
            {t} {t === 'Open' ? filteredPRs.length : PRS.filter(pr => pr.status === 'Closed').length}
          </button>
        ))}
      </div>

      {/* Filters/Search */}
      <div className="flex items-center mb-6 gap-2">
        <input
          type="text"
          className="border rounded px-3 py-2 w-full text-sm"
          placeholder="Search pull requests by title, author, or repo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="px-3 py-2 bg-gray-100 border rounded text-sm">Filters</button>
      </div>

      {/* PR List */}
      <div className="space-y-4">
        {filteredPRs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No pull requests found.</div>
        ) : (
          filteredPRs.map((pr, idx) => {
            // Find the index in PRS for assignment
            const prIndex = PRS.findIndex(
              p => p.title === pr.title && p.author === pr.author && p.repo === pr.repo
            );
            return (
              <div key={idx} className="border rounded-lg bg-white shadow-sm p-4 flex items-center justify-between hover:shadow-md">
                <div className="flex items-center gap-2">
                  {pr.status === 'Open' && (
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={checked[prIndex]}
                      onChange={e => {
                        setChecked(prev => {
                          const updated = [...prev];
                          updated[prIndex] = e.target.checked;
                          return updated;
                        });
                      }}
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-blue-700 text-md">{pr.title}</span>
                      {pr.labels.map(label => (
                        <span key={label} className="px-2 py-0.5 bg-gray-200 text-xs rounded text-gray-700">{label}</span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">{pr.repo} • {pr.author} • Updated {pr.updated}</div>
                    <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                      <span className="font-semibold">Assign to:</span> {assignedTo[prIndex] || 'Unassigned'}
                        {pr.status === 'Open' && (
                          <button
                            className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs border ml-2 hover:bg-blue-300"
                            onClick={() => setShowReassignIdx(idx)}
                          >
                            Reassign
                          </button>
                        )}
                      {showReassignIdx === idx && (
                        <div className="absolute mt-8 w-40 bg-white border rounded shadow-lg z-10">
                          <div className="p-2 border-b font-semibold text-gray-700">Select user:</div>
                          <ul>
                            {userList.map((user) => (
                              <li key={user}>
                                <button
                                  className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${assignedTo[prIndex] === user ? 'bg-blue-100 font-semibold' : ''}`}
                                  onClick={() => {
                                    setAssignedTo(prev => {
                                      const updated = [...prev];
                                      updated[prIndex] = user;
                                      return updated;
                                    });
                                    setShowReassignIdx(null);
                                  }}
                                >
                                  {user}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded text-xs font-semibold ${pr.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{pr.status}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PeerReview;
