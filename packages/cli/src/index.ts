#!/usr/bin/env node

/**
 * warplane CLI — Interchain Control Plane for Avalanche L1s.
 *
 * Talks to the local API by default (http://localhost:3100).
 * Set ICP_API_URL to override.
 */

import { Command } from "commander";
import { setJsonMode } from "./output.js";
import { doctorCommand } from "./commands/doctor.js";
import { demoCommand } from "./commands/demo.js";
import { tracesCommand } from "./commands/traces.js";
import { failuresCommand } from "./commands/failures.js";
import { scenariosCommand } from "./commands/scenarios.js";
import { importCommand } from "./commands/import.js";
import { registryCommand } from "./commands/registry.js";
import { docsMcpCommand } from "./commands/docs-mcp.js";
import { ApiUnreachableError } from "./api-client.js";

const program = new Command();

program
  .name("warplane")
  .description("Interchain Control Plane CLI for Avalanche L1s")
  .version("0.1.0")
  .option("--json", "Output JSON (for scripting)")
  .option("--api-url <url>", "API base URL (default: http://localhost:3100)")
  .hook("preAction", (_thisCmd, _actionCmd) => {
    const opts = program.opts();
    if (opts.json) setJsonMode(true);
    if (opts.apiUrl) process.env["ICP_API_URL"] = opts.apiUrl;
  });

program.addCommand(doctorCommand());
program.addCommand(demoCommand());
program.addCommand(tracesCommand());
program.addCommand(failuresCommand());
program.addCommand(scenariosCommand());
program.addCommand(importCommand());
program.addCommand(registryCommand());
program.addCommand(docsMcpCommand());

// Shell completion helper
program
  .command("completion")
  .description("Output shell completion script")
  .argument("[shell]", "Shell type: bash, zsh, fish", "bash")
  .action((shell: string) => {
    if (shell === "zsh") {
      console.log(zshCompletion());
    } else if (shell === "fish") {
      console.log(fishCompletion());
    } else {
      console.log(bashCompletion());
    }
  });

// Global error handler for nicer API-down messages
process.on("unhandledRejection", (err) => {
  if (err instanceof ApiUnreachableError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (err instanceof ApiUnreachableError) {
    console.error(err.message);
    process.exitCode = 1;
  } else if (err instanceof Error && err.message.startsWith("API ")) {
    console.error(err.message);
    process.exitCode = 1;
  } else {
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Shell completion scripts
// ---------------------------------------------------------------------------

function bashCompletion(): string {
  return `# warplane bash completion
# Add to ~/.bashrc: eval "$(warplane completion bash)"
_warplane_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local cmds="doctor demo traces failures scenarios import registry docs completion"
  local subcmds_demo="seed start"
  local subcmds_traces="list show"
  local subcmds_failures="list"
  local subcmds_scenarios="list"
  local subcmds_registry="show"
  local subcmds_docs="mcp"

  case "\${prev}" in
    warplane) COMPREPLY=( $(compgen -W "\${cmds}" -- "\${cur}") ) ;;
    demo) COMPREPLY=( $(compgen -W "\${subcmds_demo}" -- "\${cur}") ) ;;
    traces) COMPREPLY=( $(compgen -W "\${subcmds_traces}" -- "\${cur}") ) ;;
    failures) COMPREPLY=( $(compgen -W "\${subcmds_failures}" -- "\${cur}") ) ;;
    scenarios) COMPREPLY=( $(compgen -W "\${subcmds_scenarios}" -- "\${cur}") ) ;;
    registry) COMPREPLY=( $(compgen -W "\${subcmds_registry}" -- "\${cur}") ) ;;
    docs) COMPREPLY=( $(compgen -W "\${subcmds_docs}" -- "\${cur}") ) ;;
  esac
}
complete -F _warplane_completions warplane`;
}

function zshCompletion(): string {
  return `# warplane zsh completion
# Add to ~/.zshrc: eval "$(warplane completion zsh)"
_warplane() {
  local -a commands subcmds
  commands=(doctor demo traces failures scenarios import registry docs completion)
  _arguments '1:command:compadd -a commands'
  case "\${words[2]}" in
    demo) subcmds=(seed start); _arguments '2:subcommand:compadd -a subcmds' ;;
    traces) subcmds=(list show); _arguments '2:subcommand:compadd -a subcmds' ;;
    failures) subcmds=(list); _arguments '2:subcommand:compadd -a subcmds' ;;
    scenarios) subcmds=(list); _arguments '2:subcommand:compadd -a subcmds' ;;
    registry) subcmds=(show); _arguments '2:subcommand:compadd -a subcmds' ;;
    docs) subcmds=(mcp); _arguments '2:subcommand:compadd -a subcmds' ;;
  esac
}
compdef _warplane warplane`;
}

function fishCompletion(): string {
  return `# warplane fish completion
# Add to ~/.config/fish/completions/warplane.fish
complete -c warplane -n '__fish_use_subcommand' -a 'doctor demo traces failures scenarios import registry docs completion'
complete -c warplane -n '__fish_seen_subcommand_from demo' -a 'seed start'
complete -c warplane -n '__fish_seen_subcommand_from traces' -a 'list show'
complete -c warplane -n '__fish_seen_subcommand_from failures' -a 'list'
complete -c warplane -n '__fish_seen_subcommand_from scenarios' -a 'list'
complete -c warplane -n '__fish_seen_subcommand_from registry' -a 'show'
complete -c warplane -n '__fish_seen_subcommand_from docs' -a 'mcp'`;
}
