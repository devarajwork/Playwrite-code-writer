import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'GitHub PAT required in Authorization header (Bearer <token>)' });
    }

    // Assuming repository is passed via query param or header
    const repo = req.query.repo as string;
    if (!repo) {
      return res.status(400).json({ error: 'repo query parameter is required (e.g. owner/repo)' });
    }

    const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=15`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': authHeader,
        'User-Agent': 'Playwright-Code-Writer'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: 'GitHub API error', details: errorText });
    }

    const data = await response.json();
    
    // Process the data to send a clean timeline
    const runs = data.workflow_runs.map((run: any) => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion, // success, failure, etc
      html_url: run.html_url,
      created_at: run.created_at,
      actor: run.actor?.login,
      run_number: run.run_number
    }));

    res.json({ runs });
  } catch (error: any) {
    console.error('Error fetching GitHub runs:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
