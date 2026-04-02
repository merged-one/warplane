export function DocsPage() {
  return (
    <div>
      <h1>Docs & Quickstart</h1>

      <section className="section">
        <h2>Getting Started</h2>
        <ol>
          <li>
            <strong>Seed data:</strong> <code>pnpm db:seed:day1</code> — ingests
            golden fixtures from <code>harness/tmpnet/artifacts</code>
          </li>
          <li>
            <strong>Start API:</strong> <code>pnpm dev</code> — launches the
            Fastify API at <code>http://localhost:3000</code>
          </li>
          <li>
            <strong>Start Dashboard:</strong>{" "}
            <code>pnpm --filter @warplane/web dev</code> — Vite dev server at{" "}
            <code>http://localhost:5180</code>
          </li>
          <li>
            <strong>Explore:</strong> Use the Overview, Traces, Failures, and
            Scenarios pages to inspect cross-chain message lifecycle.
          </li>
        </ol>
      </section>

      <section className="section">
        <h2>Key Concepts</h2>
        <dl className="dl">
          <dt>Trace</dt>
          <dd>
            A complete cross-chain message lifecycle: from send on the source
            chain, through Warp extraction, relaying, and delivery on the
            destination.
          </dd>
          <dt>Scenario</dt>
          <dd>
            A deterministic test case (e.g. basic_send_receive, add_fee,
            retry_failed_execution) that produces one or more traces.
          </dd>
          <dt>Event Timeline</dt>
          <dd>
            Ordered sequence of events for a message: message_sent,
            warp_message_extracted, signatures_aggregated, relay_submitted,
            delivery_confirmed, etc.
          </dd>
          <dt>Failure Markers</dt>
          <dd>
            Special events: <code>execution_failed</code>,{" "}
            <code>retry_succeeded</code>, <code>fee_added</code>,{" "}
            <code>receipts_sent</code>, <code>replay_blocked</code>
          </dd>
        </dl>
      </section>

      <section className="section">
        <h2>API Endpoints</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>GET /health</code></td>
              <td>Server health + trace count</td>
            </tr>
            <tr>
              <td><code>GET /api/v1/traces</code></td>
              <td>Paginated, filterable trace list</td>
            </tr>
            <tr>
              <td><code>GET /api/v1/traces/:id</code></td>
              <td>Single trace detail</td>
            </tr>
            <tr>
              <td><code>GET /api/v1/traces/:id/timeline</code></td>
              <td>Event timeline for a trace</td>
            </tr>
            <tr>
              <td><code>GET /api/v1/traces/:id/raw</code></td>
              <td>Raw JSON payload</td>
            </tr>
            <tr>
              <td><code>GET /api/v1/failures</code></td>
              <td>Failed / blocked / pending traces</td>
            </tr>
            <tr>
              <td><code>GET /api/v1/scenarios</code></td>
              <td>Scenario run results</td>
            </tr>
            <tr>
              <td><code>GET /api/v1/chains</code></td>
              <td>Registered chains</td>
            </tr>
            <tr>
              <td><code>GET /api/v1/network</code></td>
              <td>Network manifests</td>
            </tr>
            <tr>
              <td><code>GET /api/v1/search?q=</code></td>
              <td>Full-text search</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="section">
        <h2>Links</h2>
        <ul>
          <li>
            <a href="/docs" target="_blank" rel="noopener">
              API Swagger UI
            </a>{" "}
            (requires API server running)
          </li>
          <li>
            <a href="/openapi.json" target="_blank" rel="noopener">
              OpenAPI spec (JSON)
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
