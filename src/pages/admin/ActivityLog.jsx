import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw } from 'lucide-react';

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ function_name: '', log_level: '' });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const query = {};
      if (filter.function_name) query.function_name = filter.function_name;
      if (filter.log_level) query.log_level = filter.log_level;
      
      const data = await base44.asServiceRole.entities.AppActivityLog.filter(query, '-timestamp', 100);
      setLogs(data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const levelColor = (level) => {
    if (level === 'error') return 'bg-red-100 text-red-800';
    if (level === 'warn') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const handleDelete = async (id) => {
    try {
      await base44.asServiceRole.entities.AppActivityLog.delete(id);
      setLogs(logs.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting log:', error);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Activity Log</h1>
        <Button onClick={fetchLogs} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <Input
              placeholder="Filter by function name..."
              value={filter.function_name}
              onChange={(e) => setFilter({ ...filter, function_name: e.target.value })}
            />
            <select
              className="border rounded-md px-3 py-2"
              value={filter.log_level}
              onChange={(e) => setFilter({ ...filter, log_level: e.target.value })}
            >
              <option value="">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
            <Button onClick={() => setFilter({ function_name: '', log_level: '' })} variant="secondary">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      {loading ? (
        <div className="text-center py-8">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No logs found</div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <Badge className={levelColor(log.log_level)}>{log.log_level?.toUpperCase()}</Badge>
                    <span className="font-semibold">{log.function_name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(log.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-700 mb-2">{log.message}</p>
                {log.user_email && (
                  <p className="text-xs text-gray-500">User: {log.user_email}</p>
                )}
                {log.analysis_id && (
                  <p className="text-xs text-gray-500">Analysis: {log.analysis_id}</p>
                )}
                {log.context && (
                  <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-32">
                    {JSON.stringify(log.context, null, 2)}
                  </pre>
                )}
                {log.error_details && (
                  <details className="text-xs mt-2">
                    <summary className="cursor-pointer text-red-600">Error Details</summary>
                    <pre className="bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                      {log.error_details}
                    </pre>
                  </details>
                )}
                <p className="text-xs text-gray-400 mt-3">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}