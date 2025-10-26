#!/usr/bin/env node

// Supabase MCP Server
// This provides Supabase integration for Claude Desktop

const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment or config (신규 DB: aieltmidsagiobpuebvv)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aieltmidsagiobpuebvv.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZWx0bWlkc2FnaW9icHVlYnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNzkzNTIsImV4cCI6MjA3NTY1NTM1Mn0.wUmjCxKdMGu9ZEPWd8VlcuuFD9WfZdl7yEJTKkW4Y_Y';

const supabase = createClient(supabaseUrl, supabaseKey);

// MCP Server implementation
class SupabaseMCPServer {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    process.stdin.on('data', async (data) => {
      try {
        const request = JSON.parse(data.toString());
        const response = await this.handleRequest(request);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        console.error('Error handling request:', error);
      }
    });
  }

  async handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'list_tools':
        return {
          tools: [
            {
              name: 'supabase_query',
              description: 'Query Supabase database',
              inputSchema: {
                type: 'object',
                properties: {
                  table: { type: 'string' },
                  query: { type: 'object' }
                },
                required: ['table']
              }
            },
            {
              name: 'supabase_insert',
              description: 'Insert data into Supabase',
              inputSchema: {
                type: 'object',
                properties: {
                  table: { type: 'string' },
                  data: { type: 'object' }
                },
                required: ['table', 'data']
              }
            },
            {
              name: 'supabase_update',
              description: 'Update data in Supabase',
              inputSchema: {
                type: 'object',
                properties: {
                  table: { type: 'string' },
                  data: { type: 'object' },
                  match: { type: 'object' }
                },
                required: ['table', 'data', 'match']
              }
            },
            {
              name: 'supabase_delete',
              description: 'Delete data from Supabase',
              inputSchema: {
                type: 'object',
                properties: {
                  table: { type: 'string' },
                  match: { type: 'object' }
                },
                required: ['table', 'match']
              }
            }
          ]
        };

      case 'call_tool':
        return await this.callTool(params);

      default:
        return { error: `Unknown method: ${method}` };
    }
  }

  async callTool(params) {
    const { name, arguments: args } = params;

    try {
      switch (name) {
        case 'supabase_query':
          const { data, error } = await supabase
            .from(args.table)
            .select(args.query?.select || '*')
            .limit(args.query?.limit || 100);
          
          if (error) throw error;
          return { result: data };

        case 'supabase_insert':
          const insertResult = await supabase
            .from(args.table)
            .insert(args.data);
          
          if (insertResult.error) throw insertResult.error;
          return { result: insertResult.data };

        case 'supabase_update':
          const updateResult = await supabase
            .from(args.table)
            .update(args.data)
            .match(args.match);
          
          if (updateResult.error) throw updateResult.error;
          return { result: updateResult.data };

        case 'supabase_delete':
          const deleteResult = await supabase
            .from(args.table)
            .delete()
            .match(args.match);
          
          if (deleteResult.error) throw deleteResult.error;
          return { result: deleteResult.data };

        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      return { error: error.message };
    }
  }
}

// Start the server
new SupabaseMCPServer();
console.error('Supabase MCP Server started');