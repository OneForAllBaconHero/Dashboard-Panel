'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Terminal,
  X,
  Plus,
  Trash2,
  Pencil,
  Ban,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Users,
  Power,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { slugifyMemberKey } from '@/lib/slug';
import {
  createCommand,
  updateCommand,
  deleteCommand,
  listCommands,
  blockUser,
  unblockUser,
  listBlocks,
  registerAllCommands,
  getDiscordBotStatus,
} from '@/app/actions/commands';

type CommandRow = {
  id: number;
  name: string;
  description: string;
  memberKey: string;
  enabled: boolean;
  registered: boolean;
  discordCommandId: string | null;
};

type BlockRow = {
  id: number;
  commandId: number;
  discordUserId: string;
  discordUsername: string | null;
};

type MemberLike = { name: string };

export default function CommandsSection({
  isOpen,
  onClose,
  members,
}: {
  isOpen: boolean;
  onClose: () => void;
  members: MemberLike[];
}) {
  const [commandsList, setCommandsList] = useState<CommandRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const [botStatus, setBotStatus] = useState<{ configured: boolean; username?: string; error?: string } | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMemberKey, setFormMemberKey] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [blocksModalCommand, setBlocksModalCommand] = useState<CommandRow | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [blockInput, setBlockInput] = useState('');
  const [blockNameInput, setBlockNameInput] = useState('');
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);
  const [blockError, setBlockError] = useState('');

  const memberOptions = members.map((m) => ({ key: slugifyMemberKey(m.name), name: m.name }));

  const refreshCommands = async () => {
    setIsLoading(true);
    try {
      const rows = await listCommands();
      setCommandsList(rows as unknown as CommandRow[]);
    } catch (err) {
      console.log('[v0] Erro ao carregar comandos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBotStatus = async () => {
    try {
      const status = await getDiscordBotStatus();
      setBotStatus(status);
    } catch (err) {
      console.log('[v0] Erro ao verificar status do bot:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshCommands();
      refreshBotStatus();
    }
  }, [isOpen]);

  const openCreateForm = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormMemberKey(memberOptions[0]?.key || '');
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (cmd: CommandRow) => {
    setEditingId(cmd.id);
    setFormName(cmd.name);
    setFormDescription(cmd.description);
    setFormMemberKey(cmd.memberKey);
    setFormError('');
    setShowForm(true);
  };

  const handleSaveForm = async () => {
    setFormError('');
    if (!formName.trim()) {
      setFormError('Informe o nome do comando.');
      return;
    }
    if (!formMemberKey) {
      setFormError('Selecione qual membro este comando dispara.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await updateCommand(editingId, {
          name: formName.trim().toLowerCase(),
          description: formDescription,
          memberKey: formMemberKey,
        });
      } else {
        await createCommand({
          name: formName.trim().toLowerCase(),
          description: formDescription,
          memberKey: formMemberKey,
        });
      }
      setShowForm(false);
      await refreshCommands();
      setStatusMsg({ text: 'Comando salvo. Registre no Discord para aplicar.', isError: false });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar comando.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCommand(id);
      await refreshCommands();
      setStatusMsg({ text: 'Comando removido.', isError: false });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg({ text: 'Erro ao remover comando.', isError: true });
    }
  };

  const handleToggleEnabled = async (cmd: CommandRow) => {
    try {
      await updateCommand(cmd.id, { enabled: !cmd.enabled });
      await refreshCommands();
    } catch (err) {
      setStatusMsg({ text: 'Erro ao atualizar comando.', isError: true });
    }
  };

  const handleRegisterAll = async () => {
    setIsRegistering(true);
    try {
      const result = await registerAllCommands();
      await refreshCommands();
      setStatusMsg({ text: `${result.count} comando(s) registrado(s) no Discord.`, isError: false });
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Erro ao registrar comandos no Discord.', isError: true });
    } finally {
      setIsRegistering(false);
    }
  };

  const openBlocksModal = async (cmd: CommandRow) => {
    setBlocksModalCommand(cmd);
    setBlockInput('');
    setBlockNameInput('');
    setBlockError('');
    setIsLoadingBlocks(true);
    try {
      const rows = await listBlocks(cmd.id);
      setBlocks(rows as unknown as BlockRow[]);
    } catch (err) {
      console.log('[v0] Erro ao carregar bloqueios:', err);
    } finally {
      setIsLoadingBlocks(false);
    }
  };

  const handleAddBlock = async () => {
    if (!blocksModalCommand) return;
    setBlockError('');
    try {
      await blockUser(blocksModalCommand.id, blockInput.trim(), blockNameInput.trim() || undefined);
      const rows = await listBlocks(blocksModalCommand.id);
      setBlocks(rows as unknown as BlockRow[]);
      setBlockInput('');
      setBlockNameInput('');
    } catch (err: any) {
      setBlockError(err?.message || 'Erro ao bloquear usuário.');
    }
  };

  const handleRemoveBlock = async (blockId: number) => {
    if (!blocksModalCommand) return;
    try {
      await unblockUser(blockId);
      const rows = await listBlocks(blocksModalCommand.id);
      setBlocks(rows as unknown as BlockRow[]);
    } catch (err) {
      console.log('[v0] Erro ao remover bloqueio:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 no-export">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full p-5 shadow-2xl relative flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-emerald-400" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider">Comandos do Discord</h3>
                <p className="text-[10px] text-slate-400">
                  Crie slash commands (/comando) que disparam a imagem de estatísticas de um membro
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Status message */}
          {statusMsg && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${
                statusMsg.isError
                  ? 'bg-red-950/60 text-red-300 border border-red-800/60'
                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
              }`}
            >
              {statusMsg.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
              {statusMsg.text}
            </div>
          )}

          {/* Bot status card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  botStatus?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
                }`}
              />
              <div>
                <p className="text-xs font-bold text-slate-200">
                  {botStatus?.configured ? `Bot conectado (${botStatus.username})` : 'Bot não configurado'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {botStatus?.configured
                    ? 'Comandos são globais — podem levar até 1h para propagar em todos os servidores.'
                    : botStatus?.error || 'Envie o token do bot para configurar as variáveis DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID e DISCORD_PUBLIC_KEY.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleRegisterAll}
              disabled={!botStatus?.configured || isRegistering || commandsList.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              {isRegistering ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Registrar comandos no Discord
            </button>
          </div>

          {/* Create button */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {commandsList.length} comando(s) cadastrado(s)
            </span>
            <button
              onClick={openCreateForm}
              disabled={memberOptions.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 cursor-pointer bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              <Plus size={14} />
              Criar comando
            </button>
          </div>

          {/* Commands list */}
          <div className="flex flex-col gap-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-500 gap-2 text-xs">
                <Loader2 size={16} className="animate-spin" /> Carregando comandos...
              </div>
            ) : commandsList.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-[10px] italic border border-dashed border-slate-800 rounded-xl">
                Nenhum comando cadastrado ainda. Crie o primeiro acima.
              </div>
            ) : (
              commandsList.map((cmd) => {
                const memberName = memberOptions.find((m) => m.key === cmd.memberKey)?.name || cmd.memberKey;
                return (
                  <div
                    key={cmd.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleEnabled(cmd)}
                        title={cmd.enabled ? 'Desativar comando' : 'Ativar comando'}
                        className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                          cmd.enabled ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Power size={13} />
                      </button>
                      <div>
                        <p className="text-xs font-extrabold text-slate-100 font-mono">/{cmd.name}</p>
                        <p className="text-[10px] text-slate-500">
                          Dispara: <span className="text-indigo-300 font-bold">{memberName}</span>
                          {' · '}
                          {cmd.registered ? (
                            <span className="text-emerald-400">registrado no Discord</span>
                          ) : (
                            <span className="text-amber-400">pendente de registro</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openBlocksModal(cmd)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer bg-slate-900 text-red-300 hover:bg-red-950/60 border border-red-900/40"
                      >
                        <Ban size={12} />
                        Bloqueios
                      </button>
                      <button
                        onClick={() => openEditForm(cmd)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer border border-slate-800"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(cmd.id)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/60 text-red-400 cursor-pointer border border-slate-800"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Create/Edit form modal */}
          <AnimatePresence>
            {showForm && (
              <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-4 shadow-2xl flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-100 uppercase tracking-wider">
                      {editingId ? 'Editar comando' : 'Criar comando'}
                    </h4>
                    <button
                      onClick={() => setShowForm(false)}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Nome do comando (/{formName || 'nome'})
                    </label>
                    <input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="ex: nk"
                      maxLength={32}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-500">Letras minúsculas, números e underscore. 1-32 caracteres.</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição</label>
                    <input
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="ex: Mostra as estatísticas do Nk"
                      maxLength={100}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={12} className="text-indigo-400" /> Qual imagem este comando dispara
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {memberOptions.map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setFormMemberKey(m.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                            formMemberKey === m.key
                              ? 'bg-indigo-600 text-white border-indigo-400/50'
                              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formError && (
                    <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold">
                      <AlertCircle size={12} /> {formError}
                    </div>
                  )}

                  <button
                    onClick={handleSaveForm}
                    disabled={isSaving}
                    className="mt-1 px-3 py-2 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    Salvar comando
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Blocks modal */}
          <AnimatePresence>
            {blocksModalCommand && (
              <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-4 shadow-2xl flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-100 uppercase tracking-wider">
                      Bloqueios de /{blocksModalCommand.name}
                    </h4>
                    <button
                      onClick={() => setBlocksModalCommand(null)}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    IDs de usuário do Discord listados aqui ficam impedidos de usar apenas este comando.
                  </p>

                  <div className="flex flex-col gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                    <input
                      value={blockInput}
                      onChange={(e) => setBlockInput(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="ID do usuário no Discord"
                      className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-red-500"
                    />
                    <input
                      value={blockNameInput}
                      onChange={(e) => setBlockNameInput(e.target.value)}
                      placeholder="Nome/nota (opcional)"
                      className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-red-500"
                    />
                    {blockError && (
                      <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold">
                        <AlertCircle size={12} /> {blockError}
                      </div>
                    )}
                    <button
                      onClick={handleAddBlock}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-red-600 text-white hover:bg-red-500"
                    >
                      <Ban size={12} />
                      Bloquear ID
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                    {isLoadingBlocks ? (
                      <div className="flex items-center justify-center py-4 text-slate-500 gap-2 text-[10px]">
                        <Loader2 size={13} className="animate-spin" /> Carregando...
                      </div>
                    ) : blocks.length === 0 ? (
                      <div className="text-center py-4 text-slate-500 text-[10px] italic border border-dashed border-slate-800 rounded-lg">
                        Nenhum ID bloqueado para este comando.
                      </div>
                    ) : (
                      blocks.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-2"
                        >
                          <div>
                            <p className="text-[11px] font-mono text-slate-200">{b.discordUserId}</p>
                            {b.discordUsername && <p className="text-[9px] text-slate-500">{b.discordUsername}</p>}
                          </div>
                          <button
                            onClick={() => handleRemoveBlock(b.id)}
                            className="p-1 rounded-lg bg-slate-900 hover:bg-red-950/60 text-red-400 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
