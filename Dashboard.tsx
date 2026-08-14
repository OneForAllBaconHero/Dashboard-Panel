'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toBlob } from 'html-to-image';
import { Plus, ShieldAlert, X, Trash2, Users, Activity, Layers, Ghost, Send, Loader2, Sparkles, Pencil, Skull, Heart, Flame, Sword, Shield, Star, Crown, Download, Upload, Save, RefreshCw, RotateCcw, Sliders, Castle, Maximize2, Minimize2, Camera, Copy, Eye, Monitor, Smartphone } from 'lucide-react';

const getRealOrigin = () => {
  let origin = window.location.origin;
  if (!origin || origin === 'null') {
    // Tenta obter de scripts do documento que foram carregados do host real
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const s of scripts) {
      const src = s.src || s.getAttribute('src');
      if (src && src.startsWith('http')) {
        try {
          const parsed = new URL(src);
          if (parsed.origin && parsed.origin !== 'null') {
            return parsed.origin;
          }
        } catch (e) {}
      }
    }
    const links = Array.from(document.querySelectorAll('link'));
    for (const l of links) {
      const href = l.href || l.getAttribute('href');
      if (href && href.startsWith('http')) {
        try {
          const parsed = new URL(href);
          if (parsed.origin && parsed.origin !== 'null') {
            return parsed.origin;
          }
        } catch (e) {}
      }
    }
    try {
      const parsed = new URL(window.location.href);
      if (parsed.origin && parsed.origin !== 'null') {
        return parsed.origin;
      }
    } catch (e) {
      origin = '';
    }
  }
  return origin && origin !== 'null' ? origin : '';
};

const getRealHost = () => {
  let host = window.location.host;
  if (!host || host === 'null') {
    let origin = getRealOrigin();
    if (origin) {
      try {
        return new URL(origin).host;
      } catch (e) {}
    }
  }
  return host && host !== 'null' ? host : '';
};

const getOriginalUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('data:')) {
    return url;
  }

  let resolvedUrl = url;

  // Se estiver usando o proxy de imagem, extraímos a URL original
  if (resolvedUrl.includes('/api/image-proxy?url=')) {
    try {
      const parts = resolvedUrl.split('/api/image-proxy?url=');
      if (parts.length > 1) {
        resolvedUrl = decodeURIComponent(parts[1]);
      }
    } catch (e) {
      console.error("Erro ao decodificar URL do proxy:", e);
    }
  }

  // Se for link externo de outro host ou local de outra sandbox
  if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
    const realHost = getRealHost();
    // Se for do host atual, convertemos para caminho relativo para resolver localmente com o origin atualizado
    if (realHost && resolvedUrl.includes(realHost)) {
      try {
        const parsed = new URL(resolvedUrl);
        resolvedUrl = parsed.pathname;
      } catch (e) {

        // Fallback
      }} else if (resolvedUrl.includes('/src/assets/') || resolvedUrl.includes('/assets/')) {
      // Se contiver caminhos locais mesmo vindo de outro host/sandbox antigo, extrai e trata como local
      const match = resolvedUrl.match(/(\/src\/assets\/.*|\/assets\/.*)$/);
      if (match) {
        resolvedUrl = match[1];
      }
    }
  }

  return resolvedUrl;
};

const getProxiedUrl = (url?: string) => {
  if (!url) return '';
  const original = getOriginalUrl(url);
  if (original.startsWith('data:')) {
    return original;
  }

  let resolved = original;
  // Se for um link externo de verdade (não local), passa pelo nosso proxy local de imagens para evitar CORS
  if (original.startsWith('http://') || original.startsWith('https://')) {
    const realHost = getRealHost();
    if (!realHost || !original.includes(realHost)) {
      resolved = `/api/image-proxy?url=${encodeURIComponent(original)}`;
    }
  }

  // Se resolvido for um caminho local ou relativo (por exemplo, /src/assets/... ou /api/image-proxy...),
  // adicionamos o origin absoluto para garantir a resolução correta dentro do iframe do AI Studio!
  if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) {
    const absolutePath = resolved.startsWith('/') ? resolved : `/${resolved}`;
    let origin = getRealOrigin();
    if (origin && origin !== 'null') {
      return origin + absolutePath;
    }
    return absolutePath;
  }

  return resolved;
};

const getAbsoluteOriginalUrl = (url?: string) => {
  if (!url) return '';
  const original = getOriginalUrl(url);
  if (original.startsWith('data:')) {
    return original;
  }

  // Se for local, retornamos com o host absoluto para o Discord conseguir renderizar
  if (!original.startsWith('http://') && !original.startsWith('https://')) {
    const absolutePath = original.startsWith('/') ? original : `/${original}`;
    let origin = getRealOrigin();
    if (origin && origin !== 'null') {
      return origin + absolutePath;
    }
    return absolutePath;
  }

  return original;
};

const toDataURL = async (src: string, imgElement?: HTMLImageElement): Promise<string | null> => {
  if (!src) return null;
  if (src.startsWith('data:')) return src;

  // Se o elemento da imagem já estiver carregado no DOM, tentamos usar o Canvas primeiro!
  // É o método mais rápido, seguro e offline para imagens locais/mesma origem.
  if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(imgElement, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl && dataUrl.startsWith('data:image')) {
          return dataUrl;
        }
      }
    } catch (e) {
      console.warn("Canvas-based toDataURL conversion failed (likely tainted), falling back to fetch:", e);
    }
  }

  let targetUrl = src;
  if (!src.startsWith('http://') && !src.startsWith('https://')) {
    const absolutePath = src.startsWith('/') ? src : `/${src}`;
    let origin = getRealOrigin();
    if (origin && origin !== 'null') {
      targetUrl = origin + absolutePath;
    } else {
      targetUrl = absolutePath;
    }
  } else {
    // Se for uma URL externa de verdade, usamos nosso proxy local que é 100% livre de CORS e de restrições de User-Agent do Discord/Imgur!
    const realHost = getRealHost();
    if (realHost && !targetUrl.includes(realHost)) {
      targetUrl = `/api/image-proxy?url=${encodeURIComponent(targetUrl)}`;
    }
  }

  // 1. Tenta obter da targetUrl (que agora pode ser o nosso proxy local ou link local)
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(id);
    if (res.ok) {
      let blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn("Proxy/Direct fetch for base64 failed, trying fallback...", targetUrl, e);
  }

  // Fallback 1: Se o proxy falhou, tenta obter direto (caso a imagem suporte CORS nativo)
  if (targetUrl.includes('/api/image-proxy')) {
    try {
      const originalUrl = src;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(originalUrl, { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) {
        let blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn("Direct fetch fallback failed:", e);
    }
  }

  // Fallback 2: Tenta corsproxy.io
  const originalUrlForFallback = targetUrl.includes('/api/image-proxy') ? src : targetUrl;
  if (originalUrlForFallback.startsWith('http://') || originalUrlForFallback.startsWith('https://')) {
    try {
      const fallbackUrl = `https://corsproxy.io/?${encodeURIComponent(originalUrlForFallback)}`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(fallbackUrl, { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) {
        let blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn("corsproxy.io fallback failed:", e);
    }
  }

  // Fallback 3: Tenta weserv diretamente
  try {
    const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrlForFallback)}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(proxiedUrl, { signal: controller.signal });
    clearTimeout(id);
    if (res.ok) {
      let blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.error("All proxies failed for", originalUrlForFallback, e);
  }

  return null;
};

interface ItemData {
  id: string;
  text: string;
  skinId: string;
  rarityId?: string;
  quantity?: string;
  level?: string;
  borderStyle?: string;
  customBorderColor?: string;
  ornament?: string;
}

interface Punishment {
  id: string;
  type: 'warning' | 'expulsion';
  reason: string;
  date: string;
}

interface MemberData {
  name: string;
  functions: ItemData[];
  chars: ItemData[];
  elements: ItemData[];
  artifacts: ItemData[];
  races?: ItemData[];
  ingredients?: ItemData[];
  forms?: ItemData[];
  items?: ItemData[];
  punishments: Punishment[];
  statsText?: string;
  customBadge?: string;
  customGlowColor?: string;
  customBadgeColor?: string;
  customAvatarSymbol?: string;
  customEmbedThumbnail?: string;
  customEmbedBanner?: string;
  customEmbedColor?: string;
  customAvatarUrl?: string;
  customBgUrl?: string;
  customCardSkin?: string;
  avatarGlow?: string;
  customName?: string;
  nameFont?: string;
  nameGradient?: string;
  deaths?: number;
  bounty?: number;
  resets?: number;
  trueResets?: number;
  deathsLabel?: string;
  deathsIcon?: string;
  deathsFont?: string;
  deathsGradient?: string;
  deathsButtonsStyle?: 'hover' | 'hidden' | 'visible';
  threatColor?: string;
  mainStatsColor?: string;
  kiCardColor?: string;
  ipPartCardColor?: string;
  temperatureCardColor?: string;
}

interface RoomItemData {
  id: string;
  text: string;
  rarityId: string;
  level?: string | number;
  type?: string;
  active?: boolean;
}

interface RoomData {
  name: string;
  customBadge?: string;
  level?: number;
  effects: RoomItemData[];
  artifacts: RoomItemData[];
  boosters: RoomItemData[];
  statsText?: string;
  customGlowColor?: string;
  customCardSkin?: string;
  customAvatarSymbol?: string;
  customAvatarUrl?: string;
  customBgUrl?: string;
  customEmbedThumbnail?: string;
  customEmbedBanner?: string;
  customEmbedColor?: string;
  threatColor?: string;
  nameFont?: string;
  nameGradient?: string;
}

const DEFAULT_ROOM_DATA: RoomData = {
  name: "PARADISE LOST",
  customBadge: "DOMÍNIO DO CLÃ • NÍVEL MAX",
  level: 100,
  customGlowColor: "cosmic",
  customCardSkin: "cosmic-purple",
  customAvatarSymbol: "🏛️",
  threatColor: "cosmic-purple",
  nameFont: "orbitron",
  nameGradient: "cosmic-purple",
  effects: [
  { id: "e1", text: "Aura de Amplificação Divina", rarityId: "mitico", level: "MAX", type: "Passivo", active: true },
  { id: "e2", text: "Escudo de Regeneração de Ki", rarityId: "lendario", level: "3", type: "Ativo", active: true },
  { id: "e3", text: "Barreira de Proteção Gravitacional", rarityId: "epico", level: "2", type: "Passivo", active: true }],

  artifacts: [
  { id: "a1", text: "Orbe Cósmico de Controle do Domínio", rarityId: "soberano", level: "MAX" },
  { id: "a2", text: "Cristal do Núcleo da Sala", rarityId: "mitico", level: "5" }],

  boosters: [
  { id: "b1", text: "Multiplicador de EXP do Clã", type: "EXP", level: "MAX", rarityId: "soberano" },
  { id: "b2", text: "Amplificador de Dano Global", type: "Dano", level: "5", rarityId: "lendario" },
  { id: "b3", text: "Escudo de Proteção do Domínio", type: "Proteção", level: "3", rarityId: "epico" },
  { id: "b4", text: "Taxa de Drop Aumentada", type: "Drop", level: "4", rarityId: "mitico" }],

  statsText: `Estatísticas Atuais.
PARADISE LOST
➳ Nivel do Domínio = 100 (MAX)
➳ Capacidade Máxima = 50 Membros
➳ Multiplicador de EXP = x5.0 (MAX)
➳ Nível de Ameaça = Roxo Cósmico 🌌
➳ Status do Escudo = 100% Intacto
➳ Energia do Núcleo = 1e+100 Ki
➳ Barreira Dimensional = Ativa (100%)`
};

const BOOSTER_TYPES: Record<string, {label: string;icon: string;bg: string;border: string;text: string;}> = {
  'EXP': { label: 'EXP Bônus', icon: '⚡', bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400' },
  'Dano': { label: 'Dano Bônus', icon: '⚔️', bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400' },
  'Proteção': { label: 'Proteção', icon: '🛡️', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40', text: 'text-indigo-400' },
  'Ki': { label: 'Energia / Ki', icon: '🔮', bg: 'bg-purple-500/15', border: 'border-purple-500/40', text: 'text-purple-400' },
  'Drop': { label: 'Taxa de Drop', icon: '💎', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40', text: 'text-cyan-400' },
  'Ouro': { label: 'Ouro / Recompensa', icon: '🪙', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400' },
  'Sorte': { label: 'Sorte Divina', icon: '🍀', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  'Defesa': { label: 'Defesa da Sala', icon: '🏰', bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-300' },
  'Regeneração': { label: 'Regeneração', icon: '💖', bg: 'bg-rose-500/15', border: 'border-rose-500/40', text: 'text-rose-400' }
};

const ROOM_LEVEL_STEPS = ['1', '2', '3', '4', '5', 'MAX', '+10%', '+25%', '+50%', '+100%'];
const getNextRoomLevel = (currentLvl: string | number = '1', direction: 1 | -1) => {
  const str = String(currentLvl);
  const idx = ROOM_LEVEL_STEPS.indexOf(str);
  if (idx !== -1) {
    const nextIdx = Math.max(0, Math.min(ROOM_LEVEL_STEPS.length - 1, idx + direction));
    return ROOM_LEVEL_STEPS[nextIdx];
  }
  const num = parseInt(str);
  if (!isNaN(num)) {
    const nextNum = Math.max(1, num + direction);
    return String(nextNum);
  }
  return '1';
};

const NK_STATS_DEFAULT = `Estatísticas Atuais.
nkleozin
➳ Potencia = 0
➳ Resistencia = 0
➳ Ki = 0
➳ Tipo De Ip = Humano
➳ Nivel = 0
➳ Parte do Ip = Comum 
➳ Funções = 0
➳ Sistema = Tudo Normal
➳ Ameaça = Comum
➳ Temperatura = 26°
➳ Exp = 0
➳ Kills = 0
➳ Resets = 0
➳ Mortes = Nenhum
➳ Premonia = None.
➳ 𝗧𝗿𝘂𝗲 𝗥𝗲𝘀𝗲𝘁 = ❌
➳ O Usuario pode resetar? = ❌
➳ Gang = 𝐍𝐨𝐧𝐞
➳ Raça = 𝐍𝐨𝐧𝐞
➳ Shiks: 𝐍𝐨𝐧𝐞
➳ Bankai: 𝐍𝐨𝐧𝐞
➳ Estilo Atual: 𝐍𝐨𝐧𝐞
➳ Habilidade Habilidosa: 𝐍𝐨𝐧𝐞
➳ Bugcrowd: 𝐍𝐨𝐧𝐞
➳ Orbs: 0
➳ Kromer: 0
➳ Núcleo: 𝐍𝐨𝐧𝐞
-------------
➳ classe: D
➳ 2 Forma: 𝐁𝐥𝐨𝐪𝐮𝐞𝐚𝐝𝐨
➳ Hedo: 𝐍𝐨𝐧𝐞
➳ level: 0`;

const AFOGZ_STATS_DEFAULT = `Estatísticas Atuais.
afogz
➳ Potencia = 1e+100 (MAX)
➳ Resistencia = 1e+100 (MAX)
➳ Ki = 1e+100
➳ Tipo De Ip = Humano
➳ Nivel = 0
➳ Parte do Ip = Comum 
➳ Funções = 1
➳ Sistema = Tudo Normal
➳ Ameaça =  Cósmico
➳ Temperatura = 26°
➳ Exp = 0
➳ Kills = 0
➳ Resets = 0
➳ Mortes = Nenhum
➳ Premonia = None.
➳ 𝗧𝗿𝘂𝗲 𝗥𝗲𝘀𝗲𝘁 = ❌
➳ O Usuario pode resetar? = ❌
➳ Gang = 𝐍𝐨𝐧𝐞
➳ Raça = 𝐍𝐨𝐧𝐞
➳ Shiks: 𝐍𝐨𝐧𝐞
➳ Bankai: 𝐍𝐨𝐧𝐞
➳ Estilo Atual: 𝐍𝐨𝐧𝐞
➳ Habilidade Habilidosa: 𝐍𝐨𝐧𝐞
➳ Bugcrowd: 𝐍𝐨𝐧𝐞
➳ Orbs: 0
➳ Kromer: 0
➳ Núcleo: 𝐍𝐨𝐧𝐞
-------------
➳ classe: S
➳ 2 Forma: 𝐁𝐥𝐨𝐪𝐮𝐞𝐚do
➳ Hedo: 𝐍𝐨𝐧𝐞
➳ level: 0`;

const ASTA_STATS_DEFAULT = `Estatísticas Atuais.
asta
➳ Potencia = 0
➳ Resistencia = 0
➳ Ki = 0
➳ Tipo De Ip = Humano
➳ Nivel = 0
➳ Parte do Ip = Comum
➳ Funções = 0
➳ Sistema = Tudo Normal.
➳ Ameaça = Comum
➳ Temperatura = 26°
➳ Exp = 0
➳ Kills = 0
➳ Resets = 0
➳ Mortes = Nenhum
➳ Premonia = None.
➳ 𝗧𝗿𝘂𝗲 𝗥𝗲𝘀𝗲𝘁 = ❌
➳ O Usuario pode resetar? = ❌
➳ Chars = 0
➳ Gang = 𝐍𝐨𝐧𝐞
➳ Shiks = 𝐍𝐨𝐧𝐞
➳ Bankai = 𝐍𝐨𝐧𝐞
➳ Estilo Atual = 𝐍𝐨𝐧𝐞
➳ Habilidade Habilidosa = 𝐍𝐨𝐧𝐞
➳ Bugcrowd = 𝐍𝐨𝐧𝐞
➳ Orbs = 0
➳ Kromer = 0
➳ Núcleo = 𝐍𝐨𝐧𝐞
-------------
➳ Classe = D
➳ 2 Forma = 𝐁𝐥𝐨𝐪𝐮𝐞𝐚𝐝𝐨.
➳ Hedo = 𝐍𝐨𝐧𝐞
➳ Forma Especial = 𝐁𝐥𝐨𝐪𝐮𝐞𝐚𝐝𝐨.
➳ level = 0`;

const SKIN_LIST = [
{ id: 'default', name: 'Padrão', class: 'skin-default' },
{ id: 'flame', name: 'Chamas', class: 'skin-flame' },
{ id: 'ice', name: 'Gelo', class: 'skin-ice' },
{ id: 'nature', name: 'Natureza', class: 'skin-nature' },
{ id: 'void', name: 'Vazio', class: 'skin-void' },
{ id: 'electric', name: 'Elétrico', class: 'skin-electric' },
{ id: 'obsidian', name: 'Obsidiana', class: 'skin-obsidian' },
{ id: 'gold', name: 'Ouro', class: 'skin-gold' },
{ id: 'silver', name: 'Prata', class: 'skin-silver' },
{ id: 'rose', name: 'Rosa', class: 'skin-rose' },
{ id: 'toxic', name: 'Tóxico', class: 'skin-toxic' },
{ id: 'blood', name: 'Sangue', class: 'skin-blood' },
{ id: 'ocean', name: 'Oceano', class: 'skin-ocean' },
{ id: 'galaxy', name: 'Galáxia', class: 'skin-galaxy' },
{ id: 'cyber', name: 'Cyberpunk', class: 'skin-cyber' },
{ id: 'ghost', name: 'Fantasmagórico', class: 'skin-ghost' },
{ id: 'magma', name: 'Magma', class: 'skin-magma' },
{ id: 'forest', name: 'Floresta', class: 'skin-forest' },
{ id: 'sunset', name: 'Pôr do Sol', class: 'skin-sunset' },
{ id: 'neon-blue', name: 'Neon Azul', class: 'skin-neon-blue' },
{ id: 'neon-green', name: 'Neon Verde', class: 'skin-neon-green' },
{ id: 'neon-red', name: 'Neon Vermelho', class: 'skin-neon-red' },
{ id: 'chrome', name: 'Cromado', class: 'skin-chrome' },
{ id: 'vampire', name: 'Vampiro', class: 'skin-vampire' },
{ id: 'cosmic', name: 'Cósmico', class: 'skin-cosmic' },
{ id: 'abyss', name: 'Abismo', class: 'skin-abyss' },
{ id: 'sacred', name: 'Sagrado', class: 'skin-sacred' },
{ id: 'retro', name: 'Retro Synth', class: 'skin-retro' },
{ id: 'emerald', name: 'Esmeralda', class: 'skin-emerald' },
{ id: 'sapphire', name: 'Safira', class: 'skin-sapphire' },
{ id: 'amethyst', name: 'Ametista', class: 'skin-amethyst' },
{ id: 'ruby', name: 'Rubi', class: 'skin-ruby' },
{ id: 'warrior', name: 'Guerreiro', class: 'skin-warrior' },
{ id: 'thunder', name: 'Trovão', class: 'skin-thunder' },
{ id: 'plague', name: 'Peste', class: 'skin-plague' },
{ id: 'pirate', name: 'Pirata', class: 'skin-pirate' },
{ id: 'hologram', name: 'Holograma', class: 'skin-hologram' },
{ id: 'astral', name: 'Astral', class: 'skin-astral' },
{ id: 'winter', name: 'Inverno', class: 'skin-winter' },
{ id: 'deep-sea', name: 'Submarino', class: 'skin-deep-sea' },
{ id: 'candy', name: 'Doce', class: 'skin-candy' },
{ id: 'metal', name: 'Metalúrgico', class: 'skin-metal' },
{ id: 'autumn', name: 'Outono', class: 'skin-autumn' },
{ id: 'phoenix', name: 'Fênix', class: 'skin-phoenix' },
{ id: 'diamond', name: 'Diamante', class: 'skin-diamond' },
{ id: 'quartz', name: 'Quartzo', class: 'skin-quartz' },
{ id: 'obsidian-dark', name: 'Obsidiana Negra', class: 'skin-obsidian-dark' },
{ id: 'inferno', name: 'Inferno', class: 'skin-inferno' },
{ id: 'frost', name: 'Geada', class: 'skin-frost' },
{ id: 'plasma', name: 'Plasma', class: 'skin-plasma' },
{ id: 'stellar', name: 'Estelar', class: 'skin-stellar' },
{ id: 'nebula', name: 'Nebulosa', class: 'skin-nebula' },
{ id: 'radiant', name: 'Radiante', class: 'skin-radiant' },
{ id: 'shadow', name: 'Sombra', class: 'skin-shadow' },
{ id: 'corrupted', name: 'Corrupção', class: 'skin-corrupted' },
{ id: 'purity', name: 'Pureza', class: 'skin-purity' },
{ id: 'celestial', name: 'Celestial', class: 'skin-celestial' },
{ id: 'demonic', name: 'Demônio', class: 'skin-demonic' },
{ id: 'dragon', name: 'Dragão', class: 'skin-dragon' },
{ id: 'royal-phoenix', name: 'Fênix Real', class: 'skin-royal-phoenix' },
{ id: 'eclipse', name: 'Eclipse', class: 'skin-eclipse' },
{ id: 'supernova', name: 'Supernova', class: 'skin-supernova' },
{ id: 'lightning', name: 'Relâmpago', class: 'skin-lightning' },
{ id: 'hurricane', name: 'Furacão', class: 'skin-hurricane' },
{ id: 'seismic', name: 'Sismo', class: 'skin-seismic' },
{ id: 'titanium', name: 'Titânio', class: 'skin-titanium' },
{ id: 'bronze', name: 'Bronze', class: 'skin-bronze' },
{ id: 'platinum', name: 'Platina', class: 'skin-platinum' },
{ id: 'mithril', name: 'Mitril', class: 'skin-mithril' },
{ id: 'crystal', name: 'Cristal', class: 'skin-crystal' },
{ id: 'prism', name: 'Prisma', class: 'skin-prism' },
{ id: 'rainbow', name: 'Arco-Íris', class: 'skin-rainbow' },
{ id: 'glitch', name: 'Glitch', class: 'skin-glitch' },
{ id: 'vaporwave', name: 'Vaporwave', class: 'skin-vaporwave' },
{ id: 'synthwave', name: 'Synthwave', class: 'skin-synthwave' },
{ id: 'matrix', name: 'Matrix', class: 'skin-matrix' },
{ id: 'cyber-ice', name: 'Cyber Gelo', class: 'skin-cyber-ice' },
{ id: 'cyber-fire', name: 'Cyber Fogo', class: 'skin-cyber-fire' },
{ id: 'toxic-green', name: 'Tóxico Verde', class: 'skin-toxic-green' },
{ id: 'radiation', name: 'Radiação', class: 'skin-radiation' },
{ id: 'bioluminescent', name: 'Bio-Luminoso', class: 'skin-bioluminescent' },
{ id: 'abyssal', name: 'Abissal', class: 'skin-abyssal' },
{ id: 'ancient', name: 'Antigo', class: 'skin-ancient' },
{ id: 'runic', name: 'Rúnico', class: 'skin-runic' },
{ id: 'alchemy', name: 'Alquimia', class: 'skin-alchemy' },
{ id: 'steampunk', name: 'Steampunk', class: 'skin-steampunk' },
{ id: 'dieselpunk', name: 'Dieselpunk', class: 'skin-dieselpunk' },
{ id: 'clockwork', name: 'Relógio', class: 'skin-clockwork' },
{ id: 'desert', name: 'Deserto', class: 'skin-desert' },
{ id: 'oasis', name: 'Oásis', class: 'skin-oasis' },
{ id: 'jungle', name: 'Selva', class: 'skin-jungle' },
{ id: 'swamp', name: 'Pântano', class: 'skin-swamp' },
{ id: 'taiga', name: 'Taiga', class: 'skin-taiga' },
{ id: 'volcanic', name: 'Vulcânico', class: 'skin-volcanic' },
{ id: 'carbon', name: 'Carbono', class: 'skin-carbon' },
{ id: 'neon-pink', name: 'Neon Rosa', class: 'skin-neon-pink' },
{ id: 'neon-cyan', name: 'Neon Ciano', class: 'skin-neon-cyan' },
{ id: 'neon-purple', name: 'Neon Roxo', class: 'skin-neon-purple' },
{ id: 'copper', name: 'Cobre', class: 'skin-copper' },
{ id: 'brass', name: 'Latão', class: 'skin-brass' },
{ id: 'steel', name: 'Aço', class: 'skin-steel' },
{ id: 'pearl', name: 'Pérola', class: 'skin-pearl' },
{ id: 'jade', name: 'Jade', class: 'skin-jade' },
{ id: 'amber', name: 'Âmbar', class: 'skin-amber' },
{ id: 'malachite', name: 'Malaquita', class: 'skin-malachite' },
{ id: 'turquoise', name: 'Turquesa', class: 'skin-turquoise' },
{ id: 'purple-obsidian', name: 'Obsidiana Roxa', class: 'skin-purple-obsidian' },
{ id: 'blue-flame', name: 'Fogo Azul', class: 'skin-blue-flame' },
{ id: 'black-ice', name: 'Gelo Negro', class: 'skin-black-ice' },
{ id: 'royal-blood', name: 'Sangue Real', class: 'skin-royal-blood' },
{ id: 'fog', name: 'Névoa', class: 'skin-fog' },
{ id: 'twilight', name: 'Crepúsculo', class: 'skin-twilight' },
{ id: 'aurora', name: 'Aurora', class: 'skin-aurora' },
{ id: 'solstice', name: 'Solstício', class: 'skin-solstice' },
{ id: 'equinox', name: 'Equinócio', class: 'skin-equinox' },
{ id: 'cosmos', name: 'Cosmos', class: 'skin-cosmos' },
{ id: 'purple-void', name: 'Vazio Roxo', class: 'skin-purple-void' },
{ id: 'chaos', name: 'Caos', class: 'skin-chaos' },
{ id: 'order', name: 'Ordem', class: 'skin-order' },
{ id: 'light', name: 'Luz', class: 'skin-light' },
{ id: 'darkness', name: 'Escuridão', class: 'skin-darkness' },
{ id: 'spectre', name: 'Espectro', class: 'skin-spectre' },
{ id: 'haunted', name: 'Assombração', class: 'skin-haunted' },
{ id: 'paladin', name: 'Paladino', class: 'skin-paladin' },
{ id: 'necromancer', name: 'Necromante', class: 'skin-necromancer' },
{ id: 'druid', name: 'Druida', class: 'skin-druid' },
{ id: 'mage', name: 'Mago', class: 'skin-mage' },
{ id: 'assassin', name: 'Assassino', class: 'skin-assassin' },
{ id: 'samurai', name: 'Samurai', class: 'skin-samurai' },
{ id: 'ninja', name: 'Ninja', class: 'skin-ninja' },
{ id: 'shogun', name: 'Shogun', class: 'skin-shogun' },
{ id: 'emperor', name: 'Imperador', class: 'skin-emperor' },
{ id: 'queen', name: 'Rainha', class: 'skin-queen' },
{ id: 'knight', name: 'Cavaleiro', class: 'skin-knight' },
{ id: 'gladiator', name: 'Gladiador', class: 'skin-gladiator' },
{ id: 'templar', name: 'Templário', class: 'skin-templar' },
{ id: 'archer', name: 'Arqueiro', class: 'skin-archer' },
{ id: 'valkyrie', name: 'Valquíria', class: 'skin-valkyrie' },
{ id: 'viking', name: 'Viking', class: 'skin-viking' },
{ id: 'ghost-pirate', name: 'Pirata Fantasma', class: 'skin-ghost-pirate' },
{ id: 'wizard', name: 'Mágico', class: 'skin-wizard' },
{ id: 'sphinx', name: 'Esfinge', class: 'skin-sphinx' },
{ id: 'chimera', name: 'Quimera', class: 'skin-chimera' },
{ id: 'hydra', name: 'Hydra', class: 'skin-hydra' }];


const RARITY_LIST = [
{ id: 'comum', name: 'Comum', color: '#ffffff', bg: 'bg-slate-500/10 text-slate-300 border-slate-700', glow: '' },
{ id: 'raro', name: 'Raro', color: '#38bdf8', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30', glow: 'shadow-[0_0_8px_rgba(56,189,248,0.2)]' },
{ id: 'epico', name: 'Épico', color: '#c084fc', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30', glow: 'shadow-[0_0_8px_rgba(192,132,252,0.2)]' },
{ id: 'lendario', name: 'Lendário', color: '#fbbf24', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30', glow: 'shadow-[0_0_8px_rgba(251,191,36,0.3)]' },
{ id: 'mythical', name: 'Mythical', color: '#f97316', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.3)]' },
{ id: 'exclusivo', name: 'Exclusivo', color: '#e879f9', bg: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30', glow: 'shadow-[0_0_12px_rgba(232,121,249,0.35)]' }];


export const CARD_SKINS = [
{ id: 'none', name: 'Sem Skin', description: 'Visual limpo padrão do bento card.' },
{ id: 'angel-wings', name: 'Asas Celestiais', description: 'Asas de anjo douradas e halo divino flutuando.' },
{ id: 'vampire-gothic', name: 'Vampiro Gótico', description: 'Morcegos carmesim e fumaça de sangue.' },
{ id: 'demon-wings', name: 'Asas Demoníacas', description: 'Asas de dragão negras e chifres de fogo.' },
{ id: 'ancestral-flames', name: 'Chamas Ancestrais', description: 'Labaredas de fogo místicas subindo da base.' },
{ id: 'runic-knight', name: 'Cavaleiro Rúnico', description: 'Espadas mágicas cruzadas e runas de energia.' },
{ id: 'cyber-grid', name: 'Matriz Cyberpunk', description: 'Grelha de laser neon ciano e cantos holográficos.' },
{ id: 'shadow-king', name: 'Soberano Sombrio', description: 'Coroa flutuante de sombras e névoa roxa escura.' },
{ id: 'olympus-lord', name: 'Lorde do Olimpo', description: 'Raios e relâmpagos azuis estalando ao fundo.' },
{ id: 'arcane-forest', name: 'Floresta Arcana', description: 'Vinhas com folhas e flores brilhantes envolvendo o card.' },
{ id: 'cosmic-star', name: 'Estrela Cósmica', description: 'Galáxia espiral rotativa e poeira estelar cintilante.' },
{ id: 'kraken-tentacles', name: 'Abismo do Kraken', description: 'Tentáculos roxos do submundo abraçando as laterais.' },
{ id: 'imperial-dragon', name: 'Dragão Imperial', description: 'Silhueta de dragão dourado oriental e escamas brilhantes.' },
{ id: 'eternal-ice', name: 'Gelo Eterno', description: 'Espinhos de cristal gelados brotando das pontas.' },
{ id: 'death-reaper', name: 'Ceifador da Morte', description: 'A grande foice da morte cruzada por trás do card.' },
{ id: 'divine-clouds', name: 'Nuvens Orientais', description: 'Nuvens divinas douradas no rodapé com aura mística.' },
{ id: 'cupid-hearts', name: 'Amor do Cupido', description: 'Asas cor-de-rosa e corações pulsantes flutuantes.' },
{ id: 'pirate-captain', name: 'Capitão Pirata', description: 'Sabres de pirata cruzados e bandeira negra fantasma.' },
{ id: 'egyptian-pharaoh', name: 'Olho do Faraó', description: 'Olho de Hórus dourado brilhando acima com hieróglifos.' },
{ id: 'toxic-waste', name: 'Resíduo Tóxico', description: 'Gás verde radioativo, bolhas ácidas e sinais de perigo.' },
{ id: 'chronomancer', name: 'Mago do Tempo', description: 'Engrenagens mecânicas gigantes girando no fundo.' },
{ id: 'void-rift', name: 'Abismo do Vazio', description: 'Buraco negro sugando o espaço e raios violetas.' },
{ id: 'phoenix-reborn', name: 'Asas da Fênix', description: 'Asas majestosas de fogo se expandindo do card.' },
{ id: 'samurai-spirit', name: 'Alma de Samurai', description: 'Duas Katanas embainhadas e o Sol Vermelho radiante.' },
{ id: 'fairy-pixie', name: 'Asas de Fada', description: 'Asas translúcidas de borboleta e brilho mágico cintilante.' },
{ id: 'digital-matrix', name: 'Matrix Binária', description: 'Chuva de códigos binários verdes brilhando.' },
{ id: 'eldritch-eye', name: 'Olho do Caos', description: 'Olho central pulsante e tentáculos sombrios.' },
{ id: 'steampunk-gears', name: 'Coração de Vapor', description: 'Canos de bronze expelindo fumaça e engrenagens de cobre.' },
{ id: 'fallen-archangel', name: 'Anjo Caído', description: 'Uma asa branca celestial e uma asa negra corrompida.' },
{ id: 'supreme-sovereign', name: 'Monarca Supremo', description: 'Coroa de diamantes real, aura dourada pura e joias.' },
{ id: 'nebula-void', name: 'Nebulosa do Vazio', description: 'Névoa cósmica roxa profunda e partículas estelares cintilantes.' },
{ id: 'glitch-corrupt', name: 'Código Corrompido', description: 'Efeito glitch pixelado vermelho e ciano com aviso de erro.' },
{ id: 'gold-pharaoh', name: 'Tumba de Ouro', description: 'Tempestade de areia dourada mística e escaravelhos sagrados.' },
{ id: 'royal-vanguard', name: 'Vanguarda Real', description: 'Escudo rúnico azul safira brilhante e brasão nobre.' },
{ id: 'abyssal-kraken', name: 'Fosso Abissal', description: 'Fundo do oceano escuro, bolhas azuis e tentáculos de néon.' },
{ id: 'magma-beast', name: 'Fera de Magma', description: 'Rachaduras vulcânicas de fogo e cinzas incandescentes flutuando.' },
{ id: 'celestial-saint', name: 'Santo Celestial', description: 'Aura perolada divina, asas de querubim e plumas douradas.' },
{ id: 'acid-slayer', name: 'Algoz Ácido', description: 'Gotas de ácido néon verde-lima e marcas de corte corrosivo.' },
{ id: 'frozen-valkyrie', name: 'Valquíria Gélida', description: 'Asas de gelo translúcidas azuladas e flocos de neve mágicos.' },
{ id: 'solar-deity', name: 'Deidade Solar', description: 'Um sol radiante abrasador no topo com raios solares quentes.' },
{ id: 'lunar-eclipse', name: 'Eclipse Lunar', description: 'Lua mística de prata encoberta por sombras profundas da noite.' },
{ id: 'undead-necromancer', name: 'Rei Necromante', description: 'Chamas espirituais esverdeadas e mãos esqueléticas erguendo-se.' },
{ id: 'thunder-god', name: 'Ira do Trovão', description: 'Raios elétricos dourados e nuvens de tempestade carregadas.' },
{ id: 'jungle-hunter', name: 'Caçador da Selva', description: 'Garras selvagens marcadas em vermelho e folhagens tropicais densas.' },
{ id: 'hologram-cyber', name: 'Interface Holográfica', description: 'Círculos de radar HUD néon magenta e dados flutuantes.' },
{ id: 'candy-wonderland', name: 'País dos Doces', description: 'Estrelas de açúcar pastel, algodão doce e fofura brilhante.' },
{ id: 'clockwork-steam', name: 'Mecanismo a Vapor', description: 'Rebites de bronze, manômetros e engrenagens de cobre giratórias.' },
{ id: 'shadow-assassin', name: 'Assassino Sombrio', description: 'Olhos vermelhos brilhando nas sombras e adagas de fumaça preta.' },
{ id: 'spirit-kitsune', name: 'Kitsune Celestial', description: 'Fogo fatuo azul (Kitsunebi) e silhuetas de caudas de raposa.' },
{ id: 'plague-doctor', name: 'Doutor da Peste', description: 'Máscara clássica de corvo, névoa tóxica e frascos alquímicos.' }];


export function getCardSkinClasses(skinId?: string, glowColor?: string) {
  const id = skinId && skinId !== 'none' ? skinId : glowColor || 'default';

  switch (id) {
    case 'flame':case 'hellfire':
      return {
        border: 'border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.18)] hover:border-red-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-red-950/15'
      };
    case 'ice':case 'cyber-cyan':
      return {
        border: 'border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.18)] hover:border-cyan-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-cyan-950/15'
      };
    case 'nature':
      return {
        border: 'border-green-500/40 shadow-[0_0_25px_rgba(34,197,94,0.18)] hover:border-green-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-emerald-950/15'
      };
    case 'void':case 'cosmic-purple':
      return {
        border: 'border-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.18)] hover:border-purple-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-purple-950/15'
      };
    case 'electric':
      return {
        border: 'border-yellow-500/40 shadow-[0_0_25px_rgba(234,179,8,0.18)] hover:border-yellow-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-amber-950/15'
      };
    case 'obsidian':
      return {
        border: 'border-neutral-700/50 shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:border-neutral-500',
        bg: 'bg-gradient-to-br from-neutral-900 via-neutral-950 to-slate-950'
      };
    case 'gold':case 'divine-gold':
      return {
        border: 'border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.22)] hover:border-amber-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-amber-950/20'
      };
    case 'silver':
      return {
        border: 'border-slate-500/40 shadow-[0_0_20px_rgba(148,163,184,0.15)] hover:border-slate-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-800/15'
      };
    case 'rose':
      return {
        border: 'border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.18)] hover:border-rose-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-rose-950/15'
      };
    case 'toxic':case 'emerald-toxic':
      return {
        border: 'border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.18)] hover:border-emerald-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-emerald-950/15'
      };
    case 'blood':
      return {
        border: 'border-red-600/50 shadow-[0_0_25px_rgba(220,38,38,0.22)] hover:border-red-500',
        bg: 'bg-gradient-to-br from-neutral-950 via-slate-900 to-red-950/25'
      };
    case 'ocean':
      return {
        border: 'border-blue-500/40 shadow-[0_0_25px_rgba(59,130,246,0.18)] hover:border-blue-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-blue-950/15'
      };
    case 'galaxy':
      return {
        border: 'border-fuchsia-500/45 shadow-[0_0_25px_rgba(217,70,239,0.22)] hover:border-fuchsia-400',
        bg: 'bg-gradient-to-br from-indigo-950/20 via-slate-900 to-fuchsia-950/20'
      };
    case 'cyber':
      return {
        border: 'border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.3)] hover:border-cyan-300',
        bg: 'bg-black border-2 border-cyan-500/60'
      };
    case 'ghost':
      return {
        border: 'border-white/20 backdrop-blur-xl shadow-[0_0_20px_rgba(255,255,255,0.06)] hover:border-white/30',
        bg: 'bg-slate-900/50'
      };
    case 'magma':
      return {
        border: 'border-orange-600/50 shadow-[0_0_20px_rgba(234,88,12,0.22)] hover:border-orange-500',
        bg: 'bg-gradient-to-br from-neutral-950 via-slate-950 to-orange-950/25'
      };
    case 'forest':
      return {
        border: 'border-emerald-600/40 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-emerald-500',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-emerald-950/20'
      };
    case 'sunset':
      return {
        border: 'border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.18)] hover:border-orange-400',
        bg: 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-purple-950/15'
      };
    case 'neon-blue':
      return {
        border: 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.35)] hover:border-blue-400',
        bg: 'bg-slate-950'
      };
    case 'neon-green':
      return {
        border: 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.35)] hover:border-green-400',
        bg: 'bg-slate-950'
      };
    case 'neon-red':
      return {
        border: 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.35)] hover:border-red-400',
        bg: 'bg-slate-950'
      };
    case 'chrome':
      return {
        border: 'border-slate-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:border-slate-100',
        bg: 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-750'
      };
    case 'vampire':
      return {
        border: 'border-red-950/80 shadow-[0_0_25px_rgba(153,27,27,0.3)] hover:border-red-800',
        bg: 'bg-neutral-950'
      };
    case 'nebula-void':
      return {
        border: 'border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:border-indigo-400',
        bg: 'bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950'
      };
    case 'glitch-corrupt':
      return {
        border: 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:border-cyan-400',
        bg: 'bg-gradient-to-br from-neutral-950 via-zinc-900 to-red-950/20'
      };
    case 'gold-pharaoh':
      return {
        border: 'border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.3)] hover:border-amber-400',
        bg: 'bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-950'
      };
    case 'royal-vanguard':
      return {
        border: 'border-blue-600/50 shadow-[0_0_25px_rgba(37,99,235,0.25)] hover:border-blue-500',
        bg: 'bg-gradient-to-br from-slate-900 via-blue-950/20 to-slate-900'
      };
    case 'abyssal-kraken':
      return {
        border: 'border-cyan-700/50 shadow-[0_0_25px_rgba(14,116,144,0.25)] hover:border-cyan-500',
        bg: 'bg-gradient-to-br from-slate-950 via-cyan-950/35 to-blue-950/40'
      };
    case 'magma-beast':
      return {
        border: 'border-orange-600/50 shadow-[0_0_25px_rgba(234,88,12,0.3)] hover:border-orange-500',
        bg: 'bg-gradient-to-br from-neutral-950 via-stone-900 to-orange-950/30'
      };
    case 'celestial-saint':
      return {
        border: 'border-yellow-200/40 shadow-[0_0_25px_rgba(254,240,138,0.2)] hover:border-yellow-300',
        bg: 'bg-gradient-to-br from-slate-900 via-yellow-950/10 to-slate-900'
      };
    case 'acid-slayer':
      return {
        border: 'border-lime-500/50 shadow-[0_0_25px_rgba(132,204,22,0.25)] hover:border-lime-400',
        bg: 'bg-gradient-to-br from-slate-950 via-lime-950/20 to-neutral-950'
      };
    case 'frozen-valkyrie':
      return {
        border: 'border-sky-300/40 shadow-[0_0_25px_rgba(125,211,252,0.25)] hover:border-sky-200',
        bg: 'bg-gradient-to-br from-slate-900 via-sky-950/20 to-slate-950'
      };
    case 'solar-deity':
      return {
        border: 'border-amber-400/50 shadow-[0_0_30px_rgba(245,158,11,0.35)] hover:border-amber-300',
        bg: 'bg-gradient-to-br from-slate-900 via-orange-950/25 to-slate-900'
      };
    case 'lunar-eclipse':
      return {
        border: 'border-slate-400/45 shadow-[0_0_20px_rgba(148,163,184,0.2)] hover:border-slate-300',
        bg: 'bg-gradient-to-br from-zinc-950 via-slate-950 to-zinc-900'
      };
    case 'undead-necromancer':
      return {
        border: 'border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:border-emerald-400',
        bg: 'bg-gradient-to-br from-neutral-950 via-emerald-950/25 to-neutral-900'
      };
    case 'thunder-god':
      return {
        border: 'border-yellow-400/55 shadow-[0_0_30px_rgba(234,179,8,0.35)] hover:border-yellow-300',
        bg: 'bg-gradient-to-br from-slate-950 via-yellow-950/20 to-slate-900'
      };
    case 'jungle-hunter':
      return {
        border: 'border-green-600/40 shadow-[0_0_20px_rgba(22,163,74,0.18)] hover:border-green-500',
        bg: 'bg-gradient-to-br from-slate-950 via-green-950/20 to-stone-900'
      };
    case 'hologram-cyber':
      return {
        border: 'border-fuchsia-500/50 shadow-[0_0_25px_rgba(240,46,170,0.3)] hover:border-fuchsia-400',
        bg: 'bg-gradient-to-br from-slate-950 via-purple-950/20 to-fuchsia-950/15'
      };
    case 'candy-wonderland':
      return {
        border: 'border-pink-300/50 shadow-[0_0_25px_rgba(244,114,182,0.25)] hover:border-pink-200',
        bg: 'bg-gradient-to-br from-slate-900 via-pink-950/15 to-purple-900/10'
      };
    case 'clockwork-steam':
      return {
        border: 'border-amber-700/50 shadow-[0_0_20px_rgba(180,83,9,0.2)] hover:border-amber-600',
        bg: 'bg-gradient-to-br from-stone-900 via-amber-950/15 to-stone-950'
      };
    case 'shadow-assassin':
      return {
        border: 'border-neutral-800 shadow-[0_0_20px_rgba(0,0,0,0.7)] hover:border-neutral-600',
        bg: 'bg-gradient-to-br from-neutral-950 via-neutral-900 to-black'
      };
    case 'spirit-kitsune':
      return {
        border: 'border-cyan-400/50 shadow-[0_0_25px_rgba(34,211,238,0.25)] hover:border-cyan-300',
        bg: 'bg-gradient-to-br from-slate-950 via-cyan-950/20 to-slate-950'
      };
    case 'plague-doctor':
      return {
        border: 'border-teal-700/50 shadow-[0_0_20px_rgba(15,118,110,0.2)] hover:border-teal-500',
        bg: 'bg-gradient-to-br from-stone-950 via-teal-950/25 to-stone-950'
      };
    default:
      return {
        border: 'border-slate-800 hover:border-slate-700',
        bg: 'bg-slate-900/95'
      };
  }
}

export function getSkinEmbedColor(skinId?: string, glowColor?: string) {
  const id = skinId && skinId !== 'none' ? skinId : glowColor || 'default';
  switch (id) {
    case 'flame':case 'hellfire':case 'magma':
      return 0xef4444;
    case 'ice':case 'cyber-cyan':case 'neon-blue':
      return 0x06b6d4;
    case 'nature':case 'forest':case 'neon-green':
      return 0x10b981;
    case 'void':case 'cosmic-purple':case 'galaxy':
      return 0x8b5cf6;
    case 'electric':
      return 0xeab308;
    case 'obsidian':
      return 0x404040;
    case 'gold':case 'divine-gold':
      return 0xf59e0b;
    case 'silver':case 'chrome':
      return 0x94a3b8;
    case 'rose':
      return 0xf43f5e;
    case 'toxic':case 'emerald-toxic':
      return 0x84cc16;
    case 'blood':case 'vampire':
      return 0x991b1b;
    case 'ocean':
      return 0x3b82f6;
    case 'ghost':
      return 0xf8fafc;
    case 'sunset':
      return 0xf97316;
    case 'neon-red':
      return 0xef4444;
    case 'nebula-void':
      return 0x4c1d95;
    case 'glitch-corrupt':
      return 0xef4444;
    case 'gold-pharaoh':
      return 0xd97706;
    case 'royal-vanguard':
      return 0x1d4ed8;
    case 'abyssal-kraken':
      return 0x1e3a8a;
    case 'magma-beast':
      return 0xea580c;
    case 'celestial-saint':
      return 0xfef08a;
    case 'acid-slayer':
      return 0x84cc16;
    case 'frozen-valkyrie':
      return 0x93c5fd;
    case 'solar-deity':
      return 0xf59e0b;
    case 'lunar-eclipse':
      return 0x475569;
    case 'undead-necromancer':
      return 0x10b981;
    case 'thunder-god':
      return 0xeab308;
    case 'jungle-hunter':
      return 0x15803d;
    case 'hologram-cyber':
      return 0xec4899;
    case 'candy-wonderland':
      return 0xf472b6;
    case 'clockwork-steam':
      return 0xb45309;
    case 'shadow-assassin':
      return 0x18181b;
    case 'spirit-kitsune':
      return 0x06b6d4;
    case 'plague-doctor':
      return 0x0f766e;
    default:
      return 0x10b981;
  }
}

export function getEmbedColorInteger(member: MemberData) {
  if (member.customEmbedColor) {
    let cleaned = member.customEmbedColor.replace('#', '').trim();
    if (cleaned.length === 3) {
      cleaned = cleaned.split('').map((char) => char + char).join('');
    }
    if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
      return parseInt(cleaned, 16);
    }
  }
  if (member.name.toLowerCase() === 'nkleozin') {
    return 0x010101;
  }
  return getSkinEmbedColor(member.customCardSkin, member.customGlowColor);
}

export function CardSkinEffects({ skinId }: {skinId?: string;}) {
  if (!skinId || skinId === 'none') return null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10">
      {/* 1. Angel Wings */}
      {skinId === 'angel-wings' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 w-20 h-5 rounded-full border-[3px] border-yellow-300 shadow-[0_0_20px_#fde047] opacity-90 animate-float-slow z-30" />
          <div className="absolute left-[-55px] top-1/4 -translate-y-1/2 opacity-80 origin-right animate-wings-flap text-yellow-100">
            <svg width="70" height="130" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,50 C80,20 30,30 10,60 C0,75 5,90 20,90 C40,90 70,60 100,80 C90,100 70,120 40,130 C30,133 35,145 45,140 C70,130 90,110 100,130 C95,145 80,160 60,165 C55,167 60,175 70,170 C90,160 100,145 100,200 Z" />
            </svg>
          </div>
          <div className="absolute right-[-55px] top-1/4 -translate-y-1/2 opacity-80 origin-left animate-wings-flap-right text-yellow-100">
            <svg width="70" height="130" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,50 C80,20 30,30 10,60 C0,75 5,90 20,90 C40,90 70,60 100,80 C90,100 70,120 40,130 C30,133 35,145 45,140 C70,130 90,110 100,130 C95,145 80,160 60,165 C55,167 60,175 70,170 C90,160 100,145 100,200 Z" />
            </svg>
          </div>
        </>
      }

      {/* 2. Vampire Gothic */}
      {skinId === 'vampire-gothic' &&
      <>
          <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 text-red-500 text-lg font-bold animate-float-slow filter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] z-30">🦇</div>
          <div className="absolute left-[-40px] top-[10%] opacity-40 animate-pulse text-red-600">🦇</div>
          <div className="absolute right-[-35px] top-[40%] opacity-35 animate-float-slow text-red-600">🦇</div>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-red-950/40 to-transparent blur-md z-0" />
        </>
      }

      {/* 3. Demon Wings */}
      {skinId === 'demon-wings' &&
      <>
          <div className="absolute top-[-25px] left-[35%] text-red-600 text-xl font-bold animate-float-slow filter drop-shadow-[0_0_5px_red] z-30">😈</div>
          <div className="absolute top-[-25px] right-[35%] text-red-600 text-xl font-bold animate-float-slow filter drop-shadow-[0_0_5px_red] z-30">😈</div>
          <div className="absolute left-[-60px] top-1/4 -translate-y-1/2 opacity-70 origin-right animate-wings-flap text-red-950">
            <svg width="70" height="130" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,50 C80,10 20,20 5,60 C-5,85 10,95 30,90 C50,85 75,70 100,90 C90,120 60,150 20,160 C10,162 15,175 25,170 C60,150 85,120 100,150 C95,175 60,200 40,195 C35,193 40,205 50,200 C80,180 100,155 100,200 Z" />
            </svg>
          </div>
          <div className="absolute right-[-60px] top-1/4 -translate-y-1/2 opacity-70 origin-left animate-wings-flap-right text-red-950">
            <svg width="70" height="130" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,50 C80,10 20,20 5,60 C-5,85 10,95 30,90 C50,85 75,70 100,90 C90,120 60,150 20,160 C10,162 15,175 25,170 C60,150 85,120 100,150 C95,175 60,200 40,195 C35,193 40,205 50,200 C80,180 100,155 100,200 Z" />
            </svg>
          </div>
        </>
      }

      {/* 4. Ancestral Flames */}
      {skinId === 'ancestral-flames' &&
      <div className="absolute inset-x-0 -bottom-6 flex justify-around opacity-75 z-0">
          <div className="w-12 h-16 bg-gradient-to-t from-red-600 via-orange-500 to-transparent rounded-full filter blur-sm animate-fire-rise" />
          <div className="w-16 h-20 bg-gradient-to-t from-red-600 via-orange-500 to-transparent rounded-full filter blur-md animate-fire-rise" style={{ animationDelay: '0.4s' }} />
          <div className="w-10 h-14 bg-gradient-to-t from-red-600 via-orange-500 to-transparent rounded-full filter blur-sm animate-fire-rise" style={{ animationDelay: '0.8s' }} />
        </div>
      }

      {/* 5. Runic Knight */}
      {skinId === 'runic-knight' &&
      <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] animate-aura-pulse" />
          <div className="absolute left-[-40px] top-[15%] rotate-[-35deg] text-blue-400 opacity-60 text-2xl filter drop-shadow-[0_0_8px_rgba(56,189,248,0.6)] animate-float-slow">🗡️</div>
          <div className="absolute right-[-40px] top-[15%] rotate-[35deg] text-blue-400 opacity-60 text-2xl filter drop-shadow-[0_0_8px_rgba(56,189,248,0.6)] animate-float-slow" style={{ animationDelay: '1s' }}>🗡️</div>
          <div className="absolute -inset-2 border border-blue-500/20 rounded-[30px] border-dashed animate-spin-slow opacity-30" />
        </>
      }

      {/* 6. Cyber Grid */}
      {skinId === 'cyber-grid' &&
      <>
          <div className="absolute top-[-10px] left-[-10px] w-5 h-5 border-t-2 border-l-2 border-cyan-400 animate-pulse" />
          <div className="absolute top-[-10px] right-[-10px] w-5 h-5 border-t-2 border-r-2 border-cyan-400 animate-pulse" />
          <div className="absolute bottom-[-10px] left-[-10px] w-5 h-5 border-b-2 border-l-2 border-cyan-400 animate-pulse" />
          <div className="absolute bottom-[-10px] right-[-10px] w-5 h-5 border-b-2 border-r-2 border-cyan-400 animate-pulse" />
          <div className="absolute inset-0 border border-cyan-500/10 grid grid-cols-6 grid-rows-6 opacity-20 pointer-events-none">
            <div className="border-r border-b border-cyan-500/5 col-span-6 row-span-6" />
          </div>
        </>
      }

      {/* 7. Shadow King */}
      {skinId === 'shadow-king' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-2xl animate-float-slow filter drop-shadow-[0_0_12px_purple] z-30">👑</div>
          <div className="absolute -inset-3 bg-purple-950/10 rounded-[35px] filter blur-xl animate-pulse" />
          <div className="absolute left-[-35px] top-[20%] text-purple-900 opacity-30 text-xl animate-float-slow">🔮</div>
          <div className="absolute right-[-35px] top-[60%] text-purple-900 opacity-30 text-xl animate-float-slow" style={{ animationDelay: '1.5s' }}>🔮</div>
        </>
      }

      {/* 8. Olympus Lord */}
      {skinId === 'olympus-lord' &&
      <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.06)_0%,transparent_75%)]" />
          <div className="absolute left-[-35px] top-[30%] text-cyan-400 opacity-60 text-xl animate-pulse-glow" style={{ color: '#22d3ee' }}>⚡</div>
          <div className="absolute right-[-35px] top-[50%] text-cyan-400 opacity-60 text-xl animate-pulse-glow" style={{ color: '#22d3ee', animationDelay: '0.8s' }}>⚡</div>
          <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 text-xl filter drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">🌿</div>
        </>
      }

      {/* 9. Arcane Forest */}
      {skinId === 'arcane-forest' &&
      <>
          <div className="absolute top-[-10px] left-[15%] text-emerald-500 opacity-70 animate-leaf-float text-sm">🍃</div>
          <div className="absolute bottom-[-10px] right-[15%] text-emerald-500 opacity-70 animate-leaf-float text-sm" style={{ animationDelay: '1.5s' }}>🍃</div>
          <div className="absolute left-[-30px] top-[45%] text-emerald-400 opacity-50 text-sm animate-bounce">🌸</div>
          <div className="absolute right-[-30px] top-[25%] text-emerald-400 opacity-50 text-sm animate-bounce" style={{ animationDelay: '1s' }}>🌸</div>
        </>
      }

      {/* 10. Cosmic Star */}
      {skinId === 'cosmic-star' &&
      <>
          <div className="absolute -inset-4 bg-gradient-to-r from-purple-900/10 via-fuchsia-900/10 to-indigo-900/10 rounded-[35px] filter blur-xl animate-spin-slow -z-10" />
          <div className="absolute top-[-15px] right-[10%] text-yellow-300 text-xs animate-ping">✨</div>
          <div className="absolute bottom-[-15px] left-[10%] text-yellow-300 text-xs animate-ping" style={{ animationDelay: '1.2s' }}>✨</div>
          <div className="absolute left-[-35px] top-[60%] text-fuchsia-400 opacity-60 text-lg animate-float-slow">🪐</div>
        </>
      }

      {/* 11. Kraken Tentacles */}
      {skinId === 'kraken-tentacles' &&
      <>
          <div className="absolute left-[-45px] top-[30%] text-2xl text-purple-600 opacity-50 animate-float-slow">🐙</div>
          <div className="absolute right-[-45px] top-[60%] text-2xl text-purple-600 opacity-50 animate-float-slow" style={{ animationDelay: '2s' }}>🐙</div>
          <div className="absolute inset-x-0 -bottom-4 h-12 bg-purple-950/20 blur-md rounded-full -z-10" />
        </>
      }

      {/* 12. Imperial Dragon */}
      {skinId === 'imperial-dragon' &&
      <>
          <div className="absolute inset-0 border border-yellow-500/20 rounded-[24px] pointer-events-none" />
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_8px_gold] animate-float-slow">🐲</div>
          <div className="absolute right-[-35px] bottom-[15%] text-yellow-500 opacity-30 text-2xl animate-pulse">🐉</div>
        </>
      }

      {/* 13. Eternal Ice */}
      {skinId === 'eternal-ice' &&
      <>
          <div className="absolute top-[-15px] left-[-10px] text-cyan-200 text-lg filter drop-shadow-[0_0_6px_#22d3ee]">❄️</div>
          <div className="absolute top-[-15px] right-[-10px] text-cyan-200 text-lg filter drop-shadow-[0_0_6px_#22d3ee]">❄️</div>
          <div className="absolute bottom-[-15px] left-[-10px] text-cyan-200 text-lg filter drop-shadow-[0_0_6px_#22d3ee]">❄️</div>
          <div className="absolute bottom-[-15px] right-[-10px] text-cyan-200 text-lg filter drop-shadow-[0_0_6px_#22d3ee]">❄️</div>
        </>
      }

      {/* 14. Death Reaper */}
      {skinId === 'death-reaper' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-xl opacity-80 filter drop-shadow-[0_0_8px_#10b981] z-30">💀</div>
          <div className="absolute left-[-45px] top-[20%] text-slate-500 opacity-50 text-2xl rotate-[-45deg] animate-float-slow">⚔️</div>
          <div className="absolute inset-0 bg-emerald-950/5 rounded-[24px] filter blur-lg -z-10" />
        </>
      }

      {/* 15. Divine Clouds */}
      {skinId === 'divine-clouds' &&
      <>
          <div className="absolute bottom-[-12px] inset-x-0 flex justify-center gap-3 text-lg opacity-70 animate-float-slow">
            <span>☁️</span><span>☁️</span><span>☁️</span>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.04)_0%,transparent_75%)]" />
        </>
      }

      {/* 16. Cupid Hearts */}
      {skinId === 'cupid-hearts' &&
      <>
          <div className="absolute top-[-15px] left-[20%] text-pink-500 text-xs animate-ping">💖</div>
          <div className="absolute bottom-[-15px] right-[20%] text-pink-500 text-xs animate-ping" style={{ animationDelay: '1.5s' }}>💖</div>
          <div className="absolute left-[-40px] top-[30%] text-pink-400 opacity-50 text-lg animate-float-slow">💘</div>
          <div className="absolute right-[-40px] top-[60%] text-pink-400 opacity-50 text-lg animate-float-slow" style={{ animationDelay: '0.8s' }}>💘</div>
        </>
      }

      {/* 17. Pirate Captain */}
      {skinId === 'pirate-captain' &&
      <>
          <div className="absolute top-[-22px] left-1/2 -translate-x-1/2 text-xl z-30 filter drop-shadow-[0_0_5px_white]">🏴‍☠️</div>
          <div className="absolute left-[-35px] top-[40%] text-slate-400 opacity-45 text-xl animate-float-slow">⚔️</div>
          <div className="absolute right-[-35px] top-[40%] text-slate-400 opacity-45 text-xl animate-float-slow" style={{ animationDelay: '1.2s' }}>⚔️</div>
        </>
      }

      {/* 18. Egyptian Pharaoh */}
      {skinId === 'egyptian-pharaoh' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-xl filter drop-shadow-[0_0_10px_gold] animate-float-slow z-30">👁️‍🗨️</div>
          <div className="absolute inset-0 border border-amber-500/10 rounded-[24px]" />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        </>
      }

      {/* 19. Toxic Waste */}
      {skinId === 'toxic-waste' &&
      <>
          <div className="absolute top-[-18px] left-1/2 -translate-x-1/2 text-lime-400 text-sm font-bold bg-slate-950 px-2 py-0.5 rounded border border-lime-500/40 animate-pulse z-30">☢️ TOXIC</div>
          <div className="absolute left-[-35px] top-[30%] text-lime-500 opacity-55 text-sm animate-bounce">🧪</div>
          <div className="absolute right-[-35px] top-[60%] text-lime-500 opacity-55 text-sm animate-bounce" style={{ animationDelay: '1s' }}>🧪</div>
        </>
      }

      {/* 20. Chronomancer */}
      {skinId === 'chronomancer' &&
      <>
          <div className="absolute left-[-45px] top-[40%] -translate-y-1/2 w-12 h-12 rounded-full border border-amber-600/20 flex items-center justify-center animate-spin-slow text-amber-600/30 text-lg">⚙️</div>
          <div className="absolute right-[-45px] top-[40%] -translate-y-1/2 w-12 h-12 rounded-full border border-amber-600/20 flex items-center justify-center animate-spin-reverse text-amber-600/30 text-lg">⚙️</div>
          <div className="absolute top-[-22px] left-1/2 -translate-x-1/2 text-lg filter drop-shadow-[0_0_5px_gold]">⏰</div>
        </>
      }

      {/* 21. Void Rift */}
      {skinId === 'void-rift' &&
      <>
          <div className="absolute -inset-3 bg-gradient-to-tr from-purple-950/20 to-black rounded-[30px] filter blur-lg -z-20" />
          <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 text-indigo-500 text-lg animate-ping">🕳️</div>
          <div className="absolute left-[-35px] top-[25%] text-indigo-800 opacity-40 text-lg animate-pulse">🌌</div>
        </>
      }

      {/* 22. Phoenix Reborn */}
      {skinId === 'phoenix-reborn' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_10px_orange] animate-float-slow z-30">🐦‍🔥</div>
          <div className="absolute left-[-55px] top-1/4 opacity-75 origin-right animate-wings-flap text-orange-500">
            <svg width="70" height="130" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,50 C80,10 20,20 5,60 C-5,85 10,95 30,90 C50,85 75,70 100,90 C90,120 60,150 20,160 C10,162 15,175 25,170 C60,150 85,120 100,150 C95,175 60,200 40,195 C35,193 40,205 50,200 C80,180 100,155 100,200 Z" fill="url(#phoenixGrad)" />
              <defs>
                <linearGradient id="phoenixGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="absolute right-[-55px] top-1/4 opacity-75 origin-left animate-wings-flap-right text-orange-500">
            <svg width="70" height="130" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,50 C80,10 20,20 5,60 C-5,85 10,95 30,90 C50,85 75,70 100,90 C90,120 60,150 20,160 C10,162 15,175 25,170 C60,150 85,120 100,150 C95,175 60,200 40,195 C35,193 40,205 50,200 C80,180 100,155 100,200 Z" fill="url(#phoenixGrad)" />
            </svg>
          </div>
        </>
      }

      {/* 23. Samurai Spirit */}
      {skinId === 'samurai-spirit' &&
      <>
          <div className="absolute -inset-1 border-2 border-red-600/10 rounded-[26px] -z-10" />
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-red-600 opacity-30 shadow-[0_0_15px_red] -z-10 animate-pulse" />
          <div className="absolute left-[-40px] top-[30%] rotate-[-45deg] text-lg opacity-60">⚔️</div>
          <div className="absolute right-[-40px] top-[30%] rotate-[45deg] text-lg opacity-60">⚔️</div>
        </>
      }

      {/* 24. Fairy Pixie */}
      {skinId === 'fairy-pixie' &&
      <>
          <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 text-pink-400 text-sm animate-bounce">🧚</div>
          <div className="absolute left-[-55px] top-1/4 opacity-60 origin-right animate-wings-flap text-pink-300">
            <svg width="65" height="120" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,60 C80,10 10,30 10,70 C10,100 60,100 100,110 C80,140 20,150 30,170 C40,190 80,160 100,200 Z" />
            </svg>
          </div>
          <div className="absolute right-[-55px] top-1/4 opacity-60 origin-left animate-wings-flap-right text-cyan-300">
            <svg width="65" height="120" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,60 C80,10 10,30 10,70 C10,100 60,100 100,110 C80,140 20,150 30,170 C40,190 80,160 100,200 Z" />
            </svg>
          </div>
        </>
      }

      {/* 25. Digital Matrix */}
      {skinId === 'digital-matrix' &&
      <>
          <div className="absolute inset-y-0 left-[-35px] w-6 font-mono text-[8px] text-green-500 overflow-hidden select-none opacity-40 animate-matrix-fade leading-none">
            0101<br />1010<br />0110<br />1001<br />1100<br />0011<br />1011<br />0100
          </div>
          <div className="absolute inset-y-0 right-[-35px] w-6 font-mono text-[8px] text-green-500 overflow-hidden select-none opacity-40 animate-matrix-fade leading-none" style={{ animationDelay: '1.5s' }}>
            1100<br />0011<br />1011<br />0101<br />1010<br />0110<br />1001<br />0100
          </div>
        </>
      }

      {/* 26. Eldritch Eye */}
      {skinId === 'eldritch-eye' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-2xl animate-float-slow filter drop-shadow-[0_0_8px_purple] z-30">👁️</div>
          <div className="absolute left-[-35px] top-[30%] text-purple-900 opacity-55 text-xl animate-pulse">🐙</div>
          <div className="absolute right-[-35px] top-[50%] text-purple-900 opacity-55 text-xl animate-pulse" style={{ animationDelay: '1.2s' }}>🐙</div>
        </>
      }

      {/* 27. Steampunk Gears */}
      {skinId === 'steampunk-gears' &&
      <>
          <div className="absolute top-[-22px] left-[30%] text-amber-700 opacity-60 text-lg animate-spin-slow">⚙️</div>
          <div className="absolute top-[-22px] right-[30%] text-amber-700 opacity-60 text-lg animate-spin-reverse">⚙️</div>
          <div className="absolute left-[-35px] top-[50%] text-amber-800 opacity-50 text-xl">🔌</div>
          <div className="absolute right-[-35px] top-[50%] text-amber-800 opacity-50 text-xl">🔌</div>
        </>
      }

      {/* 28. Fallen Archangel */}
      {skinId === 'fallen-archangel' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 w-16 h-4 rounded-full border-2 border-purple-900 shadow-[0_0_10px_purple] opacity-80 animate-float-slow z-30" />
          <div className="absolute left-[-55px] top-1/4 -translate-y-1/2 opacity-70 origin-right animate-wings-flap text-slate-200">
            <svg width="65" height="120" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,50 C80,20 30,30 10,60 C0,75 5,90 20,90 C40,90 70,60 100,80 C90,100 70,120 40,130 C30,133 35,145 45,140 C70,130 90,110 100,130 C95,145 80,160 60,165 C55,167 60,175 70,170 C90,160 100,145 100,200 Z" />
            </svg>
          </div>
          <div className="absolute right-[-55px] top-1/4 -translate-y-1/2 opacity-70 origin-left animate-wings-flap-right text-slate-950">
            <svg width="65" height="120" viewBox="0 0 100 200" fill="currentColor">
              <path d="M100,50 C80,20 30,30 10,60 C0,75 5,90 20,90 C40,90 70,60 100,80 C90,100 70,120 40,130 C30,133 35,145 45,140 C70,130 90,110 100,130 C95,145 80,160 60,165 C55,167 60,175 70,170 C90,160 100,145 100,200 Z" />
            </svg>
          </div>
        </>
      }

      {/* 29. Supreme Sovereign */}
      {skinId === 'supreme-sovereign' &&
      <>
          <div className="absolute top-[-26px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_15px_rgba(251,191,36,0.9)] animate-float-slow z-30">👑</div>
          <div className="absolute inset-0 border-[2px] border-yellow-500/20 rounded-[24px] shadow-[0_0_15px_rgba(251,191,36,0.15)] -z-10" />
          <div className="absolute left-[-40px] top-[30%] text-yellow-500 opacity-60 text-lg animate-bounce">💎</div>
          <div className="absolute right-[-40px] top-[50%] text-yellow-500 opacity-60 text-lg animate-bounce" style={{ animationDelay: '1.2s' }}>💎</div>
        </>
      }

      {/* 30. Nebula Void */}
      {skinId === 'nebula-void' &&
      <>
          <div className="absolute top-[-22px] left-1/4 text-purple-400 text-xs animate-ping">✨</div>
          <div className="absolute bottom-[-22px] right-1/4 text-purple-400 text-xs animate-ping" style={{ animationDelay: '1s' }}>✨</div>
          <div className="absolute left-[-42px] top-[40%] text-indigo-500 opacity-60 text-lg animate-float-slow">🌌</div>
          <div className="absolute right-[-42px] top-[40%] text-indigo-500 opacity-60 text-lg animate-float-slow" style={{ animationDelay: '1.5s' }}>🌌</div>
        </>
      }

      {/* 31. Glitch Corrupt */}
      {skinId === 'glitch-corrupt' &&
      <>
          <div className="absolute top-[-16px] left-[10%] text-red-500 font-mono text-[8px] tracking-widest bg-black px-1.5 border border-red-500/50 animate-pulse">⚠️ SYSTEM_FAIL_</div>
          <div className="absolute inset-y-0 left-[-2px] w-[1px] bg-cyan-400/50 animate-pulse" />
          <div className="absolute inset-y-0 right-[-2px] w-[1px] bg-red-500/50 animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-[-16px] right-[10%] text-cyan-400 font-mono text-[8px] tracking-widest bg-black px-1.5 border border-cyan-500/50 animate-pulse">OVERLOAD_CRIT</div>
        </>
      }

      {/* 32. Gold Pharaoh */}
      {skinId === 'gold-pharaoh' &&
      <>
          <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_12px_gold] animate-float-slow z-30">📿</div>
          <div className="absolute left-[-38px] top-[25%] text-amber-500 opacity-60 text-xl animate-float-slow">🪲</div>
          <div className="absolute right-[-38px] top-[55%] text-amber-500 opacity-60 text-xl animate-float-slow" style={{ animationDelay: '1.2s' }}>🪲</div>
          <div className="absolute bottom-[-12px] inset-x-0 text-center text-[8px] tracking-widest text-amber-600/50 font-serif">𓂀 𓋹 𓎬 𓂀</div>
        </>
      }

      {/* 33. Royal Vanguard */}
      {skinId === 'royal-vanguard' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-float-slow z-30">🛡️</div>
          <div className="absolute left-[-42px] top-[30%] text-blue-500 opacity-45 text-xl animate-pulse">⚔️</div>
          <div className="absolute right-[-42px] top-[60%] text-blue-500 opacity-45 text-xl animate-pulse" style={{ animationDelay: '0.8s' }}>⚔️</div>
        </>
      }

      {/* 34. Abyssal Kraken */}
      {skinId === 'abyssal-kraken' &&
      <>
          <div className="absolute left-[-45px] top-[20%] text-2xl text-cyan-700 opacity-50 animate-float-slow">🐙</div>
          <div className="absolute right-[-45px] top-[50%] text-2xl text-blue-800 opacity-50 animate-float-slow" style={{ animationDelay: '1.4s' }}>🐙</div>
          <div className="absolute top-[-18px] left-[30%] text-cyan-500 text-xs animate-ping">🫧</div>
          <div className="absolute bottom-[-18px] right-[30%] text-blue-400 text-xs animate-ping" style={{ animationDelay: '0.7s' }}>🫧</div>
        </>
      }

      {/* 35. Magma Beast */}
      {skinId === 'magma-beast' &&
      <>
          <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_10px_orange] z-30">🌋</div>
          <div className="absolute left-[-38px] top-[35%] text-orange-600 opacity-50 text-xl animate-bounce">🔥</div>
          <div className="absolute right-[-38px] top-[35%] text-orange-600 opacity-50 text-xl animate-bounce" style={{ animationDelay: '1s' }}>🔥</div>
        </>
      }

      {/* 36. Celestial Saint */}
      {skinId === 'celestial-saint' &&
      <>
          <div className="absolute top-[-28px] left-1/2 -translate-x-1/2 w-14 h-4 rounded-full border-2 border-yellow-200/80 shadow-[0_0_12px_#fef08a] opacity-90 animate-float-slow z-30" />
          <div className="absolute left-[-45px] top-[25%] text-yellow-100 opacity-50 text-lg animate-float-slow">🪶</div>
          <div className="absolute right-[-45px] top-[55%] text-yellow-100 opacity-50 text-lg animate-float-slow" style={{ animationDelay: '1.2s' }}>🪶</div>
        </>
      }

      {/* 37. Acid Slayer */}
      {skinId === 'acid-slayer' &&
      <>
          <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 text-lime-400 text-sm font-bold animate-pulse z-30">🧪 HAZARD</div>
          <div className="absolute left-[-35px] top-[30%] text-lime-500 opacity-55 text-sm animate-bounce">🟢</div>
          <div className="absolute right-[-35px] top-[60%] text-lime-500 opacity-55 text-sm animate-bounce" style={{ animationDelay: '0.8s' }}>🟢</div>
        </>
      }

      {/* 38. Frozen Valkyrie */}
      {skinId === 'frozen-valkyrie' &&
      <>
          <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 text-xl filter drop-shadow-[0_0_8px_cyan] animate-float-slow z-30">🛡️❄️</div>
          <div className="absolute left-[-42px] top-[40%] text-cyan-200 opacity-60 text-lg animate-pulse">❄️</div>
          <div className="absolute right-[-42px] top-[40%] text-cyan-200 opacity-60 text-lg animate-pulse" style={{ animationDelay: '1.1s' }}>❄️</div>
        </>
      }

      {/* 39. Solar Deity */}
      {skinId === 'solar-deity' &&
      <>
          <div className="absolute top-[-28px] left-1/2 -translate-x-1/2 text-3xl filter drop-shadow-[0_0_15px_#f59e0b] animate-spin-slow z-30">☀️</div>
          <div className="absolute left-[-38px] top-[25%] text-amber-500 opacity-45 text-lg animate-pulse">🔥</div>
          <div className="absolute right-[-38px] top-[65%] text-amber-500 opacity-45 text-lg animate-pulse" style={{ animationDelay: '0.9s' }}>🔥</div>
        </>
      }

      {/* 40. Lunar Eclipse */}
      {skinId === 'lunar-eclipse' &&
      <>
          <div className="absolute top-[-26px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_12px_#94a3b8] animate-float-slow z-30">🌙</div>
          <div className="absolute left-[-35px] top-[30%] text-slate-400 opacity-55 text-md animate-pulse">⭐</div>
          <div className="absolute right-[-35px] top-[50%] text-slate-400 opacity-55 text-md animate-pulse" style={{ animationDelay: '1.3s' }}>⭐</div>
        </>
      }

      {/* 41. Undead Necromancer */}
      {skinId === 'undead-necromancer' &&
      <>
          <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 text-xl filter drop-shadow-[0_0_10px_#10b981] animate-float-slow z-30">💀🔥</div>
          <div className="absolute left-[-35px] top-[40%] text-emerald-600 opacity-50 text-xl animate-bounce">🧟</div>
          <div className="absolute right-[-35px] top-[40%] text-emerald-600 opacity-50 text-xl animate-bounce" style={{ animationDelay: '1.2s' }}>🧟</div>
        </>
      }

      {/* 42. Thunder God */}
      {skinId === 'thunder-god' &&
      <>
          <div className="absolute top-[-26px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_10px_gold] animate-pulse z-30">⚡🌩️</div>
          <div className="absolute left-[-38px] top-[30%] text-yellow-500 opacity-60 text-lg animate-pulse-glow">⚡</div>
          <div className="absolute right-[-38px] top-[60%] text-yellow-500 opacity-60 text-lg animate-pulse-glow" style={{ animationDelay: '0.6s' }}>⚡</div>
        </>
      }

      {/* 43. Jungle Hunter */}
      {skinId === 'jungle-hunter' &&
      <>
          <div className="absolute top-[-22px] left-1/2 -translate-x-1/2 text-xl filter drop-shadow-[0_0_5px_green] animate-float-slow z-30">🐾</div>
          <div className="absolute left-[-35px] top-[20%] text-emerald-600 opacity-50 text-lg animate-bounce">🍃</div>
          <div className="absolute right-[-35px] top-[50%] text-emerald-600 opacity-50 text-lg animate-bounce" style={{ animationDelay: '1s' }}>🍃</div>
        </>
      }

      {/* 44. Hologram Cyber */}
      {skinId === 'hologram-cyber' &&
      <>
          <div className="absolute top-[-18px] left-[20%] text-fuchsia-400 font-mono text-[7px] tracking-wider animate-pulse">SYS_CALIBRATED_88%</div>
          <div className="absolute left-[-42px] top-[35%] w-8 h-8 rounded-full border border-fuchsia-500/30 flex items-center justify-center animate-spin-slow text-[8px] text-fuchsia-400/40 font-mono">⌖</div>
          <div className="absolute right-[-42px] top-[55%] w-8 h-8 rounded-full border border-fuchsia-500/30 flex items-center justify-center animate-spin-reverse text-[8px] text-fuchsia-400/40 font-mono">⌖</div>
        </>
      }

      {/* 45. Candy Wonderland */}
      {skinId === 'candy-wonderland' &&
      <>
          <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_8px_pink] animate-float-slow z-30">🍭</div>
          <div className="absolute left-[-38px] top-[30%] text-pink-400 opacity-60 text-lg animate-bounce">🍬</div>
          <div className="absolute right-[-38px] top-[60%] text-pink-400 opacity-60 text-lg animate-bounce" style={{ animationDelay: '1.2s' }}>🍩</div>
        </>
      }

      {/* 46. Clockwork Steam */}
      {skinId === 'clockwork-steam' &&
      <>
          <div className="absolute left-[-45px] top-[40%] -translate-y-1/2 w-10 h-10 rounded-full border border-amber-800/30 flex items-center justify-center animate-spin-slow text-amber-800/40 text-sm">⚙️</div>
          <div className="absolute right-[-45px] top-[40%] -translate-y-1/2 w-10 h-10 rounded-full border border-amber-800/30 flex items-center justify-center animate-spin-reverse text-amber-800/40 text-sm">⚙️</div>
          <div className="absolute top-[-22px] left-1/2 -translate-x-1/2 text-lg filter drop-shadow-[0_0_5px_rgba(180,83,9,0.8)]">🕰️</div>
        </>
      }

      {/* 47. Shadow Assassin */}
      {skinId === 'shadow-assassin' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-xl filter drop-shadow-[0_0_12px_red] animate-pulse z-30">👁️‍🗨️</div>
          <div className="absolute left-[-40px] top-[30%] rotate-[-45deg] text-red-500 opacity-60 text-lg animate-float-slow">🗡️</div>
          <div className="absolute right-[-40px] top-[50%] rotate-[45deg] text-red-500 opacity-60 text-lg animate-float-slow" style={{ animationDelay: '0.8s' }}>🗡️</div>
        </>
      }

      {/* 48. Spirit Kitsune */}
      {skinId === 'spirit-kitsune' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-2xl filter drop-shadow-[0_0_10px_cyan] animate-float-slow z-30">🦊</div>
          <div className="absolute left-[-42px] top-[30%] text-cyan-400 opacity-55 text-lg animate-bounce">🔥</div>
          <div className="absolute right-[-42px] top-[60%] text-cyan-400 opacity-55 text-lg animate-bounce" style={{ animationDelay: '1.2s' }}>🔥</div>
        </>
      }

      {/* 49. Plague Doctor */}
      {skinId === 'plague-doctor' &&
      <>
          <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-2xl z-30">🎭</div>
          <div className="absolute left-[-38px] top-[25%] text-teal-600 opacity-50 text-xl animate-float-slow">🧪</div>
          <div className="absolute right-[-38px] top-[55%] text-teal-600 opacity-50 text-xl animate-float-slow" style={{ animationDelay: '1.5s' }}>🧪</div>
        </>
      }
    </div>);

}

const INITIAL_MEMBERS: MemberData[] = [
{
  name: 'Asta',
  functions: [],
  chars: [],
  elements: [],
  artifacts: [],
  races: [],
  ingredients: [],
  forms: [],
  items: [],
  punishments: [],
  statsText: ASTA_STATS_DEFAULT,
  customBadge: 'Líder',
  customGlowColor: 'default',
  deaths: 0,
  resets: 0,
  trueResets: 0
},
{
  name: 'Nkleozin',
  functions: [],
  chars: [],
  elements: [],
  artifacts: [],
  races: [],
  ingredients: [],
  forms: [],
  items: [],
  punishments: [],
  statsText: NK_STATS_DEFAULT,
  customBadge: 'Soberano',
  customGlowColor: 'cosmic-purple',
  customAvatarUrl: '',
  customBgUrl: '',
  deaths: 0,
  resets: 0,
  trueResets: 0
},
{
  name: 'Afogz',
  functions: [],
  chars: [],
  elements: [],
  artifacts: [],
  races: [],
  ingredients: [],
  forms: [],
  items: [],
  punishments: [],
  statsText: AFOGZ_STATS_DEFAULT,
  customBadge: 'Membro',
  customGlowColor: 'cyber-cyan',
  deaths: 0,
  resets: 0,
  trueResets: 0
}];


const sanitizeMembersList = (list: MemberData[]): MemberData[] => {
  return list.
  filter((m) => m.name.toLowerCase() !== 'ameaa').
  map((m) => {
    let avatarUrl = m.customAvatarUrl || '';
    let bgUrl = m.customBgUrl || '';
    let embedThumbnail = m.customEmbedThumbnail || '';
    let embedBanner = m.customEmbedBanner || '';

    // Clear deleted local files
    const isLocalDeleted = (url: string) => url.includes('nkleozin_avatar') || url.includes('nkleozin-avatar');
    if (isLocalDeleted(avatarUrl)) avatarUrl = '';
    if (isLocalDeleted(bgUrl)) bgUrl = '';
    if (isLocalDeleted(embedThumbnail)) embedThumbnail = '';
    if (isLocalDeleted(embedBanner)) embedBanner = '';

    const nameLower = m.name.toLowerCase();

    // Check keywords to prevent cross-contamination
    const hasNkKeywords = (url: string) => {
      const u = url.toLowerCase();
      return u.includes('nkleozin') || u.includes('nk_avatar') || u.includes('nk-avatar') || u.includes('soberano');
    };
    const hasAstaKeywords = (url: string) => {
      const u = url.toLowerCase();
      return u.includes('asta') || u.includes('lider');
    };
    const hasAfogzKeywords = (url: string) => {
      const u = url.toLowerCase();
      return u.includes('afogz') || u.includes('afog');
    };

    if (nameLower === 'asta') {
      if (hasNkKeywords(avatarUrl) || hasAfogzKeywords(avatarUrl)) avatarUrl = '';
      if (hasNkKeywords(bgUrl) || hasAfogzKeywords(bgUrl)) bgUrl = '';
      if (hasNkKeywords(embedThumbnail) || hasAfogzKeywords(embedThumbnail)) embedThumbnail = '';
      if (hasNkKeywords(embedBanner) || hasAfogzKeywords(embedBanner)) embedBanner = '';
    } else if (nameLower === 'nkleozin') {
      if (hasAstaKeywords(avatarUrl) || hasAfogzKeywords(avatarUrl)) avatarUrl = '';
      if (hasAstaKeywords(bgUrl) || hasAfogzKeywords(bgUrl)) bgUrl = '';
      if (hasAstaKeywords(embedThumbnail) || hasAfogzKeywords(embedThumbnail)) embedThumbnail = '';
      if (hasAstaKeywords(embedBanner) || hasAfogzKeywords(embedBanner)) embedBanner = '';
    } else if (nameLower === 'afogz') {
      if (hasAstaKeywords(avatarUrl) || hasNkKeywords(avatarUrl)) avatarUrl = '';
      if (hasAstaKeywords(bgUrl) || hasNkKeywords(bgUrl)) bgUrl = '';
      if (hasAstaKeywords(embedThumbnail) || hasNkKeywords(embedThumbnail)) embedThumbnail = '';
      if (hasAstaKeywords(embedBanner) || hasNkKeywords(embedBanner)) embedBanner = '';
    }

    // Also check for sharing identical URLs between these three core members
    const otherCoreMembers = list.filter((other) => other.name !== m.name && ['asta', 'nkleozin', 'afogz'].includes(other.name.toLowerCase()));

    otherCoreMembers.forEach((other) => {
      const otherAvatar = other.customAvatarUrl || '';
      const otherBg = other.customBgUrl || '';
      const otherThumb = other.customEmbedThumbnail || '';
      const otherBanner = other.customEmbedBanner || '';

      if (avatarUrl && avatarUrl === otherAvatar) {
        if (!avatarUrl.toLowerCase().includes(nameLower)) {
          avatarUrl = '';
        }
      }
      if (bgUrl && bgUrl === otherBg) {
        if (!bgUrl.toLowerCase().includes(nameLower)) {
          bgUrl = '';
        }
      }
      if (embedThumbnail && embedThumbnail === otherThumb) {
        if (!embedThumbnail.toLowerCase().includes(nameLower)) {
          embedThumbnail = '';
        }
      }
      if (embedBanner && embedBanner === otherBanner) {
        if (!embedBanner.toLowerCase().includes(nameLower)) {
          embedBanner = '';
        }
      }
    });

    return {
      ...m,
      customAvatarUrl: avatarUrl || undefined,
      customBgUrl: bgUrl || undefined,
      customEmbedThumbnail: embedThumbnail || undefined,
      customEmbedBanner: embedBanner || undefined
    };
  });
};

export default function Dashboard() {
  const [members, setMembers] = useState<MemberData[]>(() => {
    const saved = localStorage.getItem('studio_members');
    const migrationV2 = localStorage.getItem('studio_migration_v2');

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const parsedMapped = parsed.map((m: any) => {
          let currentStats = m.statsText;
          const nameLower = m.name?.toLowerCase();

          if (!currentStats || !currentStats.trim()) {
            if (nameLower === 'asta') {
              currentStats = ASTA_STATS_DEFAULT;
            } else if (nameLower === 'nkleozin') {
              currentStats = NK_STATS_DEFAULT;
            } else if (nameLower === 'afogz') {
              currentStats = AFOGZ_STATS_DEFAULT;
            }
          } else if (nameLower === 'afogz' && (!currentStats.includes('pode resetar') || !currentStats.includes('Mortes'))) {

            // Keep current stats unless legacy format missing core keys
          } else if (currentStats && !currentStats.includes('Mortes')) {if (currentStats.includes('Resets')) {
              currentStats = currentStats.replace(/([^\n]*Resets[^\n]*)/, '$1\n➳ Mortes = Nenhum');
            } else {
              currentStats = currentStats + '\n➳ Mortes = Nenhum';
            }
          }
          if (currentStats && !currentStats.includes('pode resetar')) {
            if (currentStats.includes('𝗧𝗿𝘂𝗲 𝗥𝗲𝘀𝗲𝘁')) {
              currentStats = currentStats.replace(/([^\n]*𝗧𝗿𝘂𝗲 𝗥𝗲𝘀𝗲𝘁[^\n]*)/, '$1\n➳ O Usuario pode resetar? = ❌');
            } else {
              currentStats = currentStats + '\n➳ O Usuario pode resetar? = ❌';
            }
          }
          if (currentStats === undefined) {
            currentStats = nameLower === 'nkleozin' ? NK_STATS_DEFAULT : nameLower === 'afogz' ? AFOGZ_STATS_DEFAULT : nameLower === 'asta' ? ASTA_STATS_DEFAULT : undefined;
          }

          if (currentStats) {
            // Auto migrate EP (Energy Point) to Ki
            currentStats = currentStats.replace(/EP\s*\(Energy\s*Point\)/gi, 'Ki');
            currentStats = currentStats.replace(/➳\s*EP\s*=/gi, '➳ Ki =');
            // Auto migrate Recistencia to Resistencia
            currentStats = currentStats.replace(/recistencia/gi, 'resistencia');
            currentStats = currentStats.replace(/Recistencia/gi, 'Resistencia');
            currentStats = currentStats.replace(/recistência/gi, 'resistência');
            currentStats = currentStats.replace(/Recistência/gi, 'Resistência');
          }

          let resetsVal = m.resets;
          if (resetsVal === undefined && currentStats) {
            const rMatch = currentStats.match(/➳\s*Resets\s*=\s*(\d+)/i) || currentStats.match(/Resets\s*=\s*(\d+)/i);
            resetsVal = rMatch ? parseInt(rMatch[1]) : 0;
          } else if (resetsVal === undefined) {
            resetsVal = 0;
          }

          let trueResetsVal = m.trueResets;
          if (trueResetsVal === undefined && currentStats) {
            const trMatch = currentStats.match(/➳\s*True\s*Reset\s*=\s*✅/iu) ||
            currentStats.match(/True\s*Reset\s*=\s*✅/i) ||
            currentStats.match(/𝗧𝗿𝘂𝗲\s*𝗥𝗲𝘀𝗲𝘁\s*=\s*✅/iu) ||
            currentStats.match(/➳\s*True\s*Reset\s*=\s*(\d+)/i) ||
            currentStats.match(/True\s*Reset\s*=\s*(\d+)/i) ||
            currentStats.match(/𝗧𝗿𝘂𝗲\s*𝗥𝗲𝘀𝗲𝘁\s*=\s*(\d+)/iu);
            if (trMatch) {
              if (trMatch[0].includes('✅')) {
                trueResetsVal = 1;
              } else if (trMatch[1]) {
                trueResetsVal = parseInt(trMatch[1]) > 0 ? 1 : 0;
              } else {
                trueResetsVal = 1;
              }
            } else {
              trueResetsVal = 0;
            }
          } else if (trueResetsVal === undefined) {
            trueResetsVal = 0;
          }

          return {
            ...m,
            functions: m.functions || [],
            chars: m.chars || [],
            elements: m.elements || [],
            artifacts: m.artifacts || [],
            races: m.races || [],
            ingredients: m.ingredients || [],
            forms: m.forms || [],
            items: m.items || [],
            punishments: m.punishments || [],
            statsText: currentStats,
            customBadge: m.customBadge !== undefined ? m.customBadge : m.name === 'Nkleozin' ? 'Soberano' : m.name === 'Afogz' ? 'Membro' : m.name === 'Asta' ? 'Líder' : undefined,
            customGlowColor: m.customGlowColor !== undefined ? m.customGlowColor : 'default',
            threatColor: m.threatColor !== undefined ? m.threatColor : 'default',
            mainStatsColor: m.mainStatsColor !== undefined ? m.mainStatsColor : 'default',
            kiCardColor: m.kiCardColor !== undefined ? m.kiCardColor : 'default',
            ipPartCardColor: m.ipPartCardColor !== undefined ? m.ipPartCardColor : 'default',
            temperatureCardColor: m.temperatureCardColor !== undefined ? m.temperatureCardColor : 'default',
            customBadgeColor: m.customBadgeColor !== undefined ? m.customBadgeColor : 'default',
            customAvatarSymbol: m.customAvatarSymbol || undefined,
            customAvatarUrl: m.customAvatarUrl,
            customBgUrl: m.customBgUrl,
            customEmbedThumbnail: m.customEmbedThumbnail || undefined,
            customEmbedBanner: m.customEmbedBanner || undefined,
            customEmbedColor: m.customEmbedColor || undefined,
            customCardSkin: m.customCardSkin || 'none',
            deathsGradient: m.name === 'Asta' && m.deathsGradient === 'gold-royal' ? 'crimson-hellfire' : m.deathsGradient || 'crimson-hellfire',
            avatarGlow: m.avatarGlow || 'none',
            deaths: m.deaths !== undefined ? m.deaths : 0,
            bounty: m.bounty !== undefined ? m.bounty : 0,
            resets: resetsVal,
            trueResets: trueResetsVal
          };
        });

        // Auto-migration: insert any missing initial members
        const finalMembers = [...parsedMapped];
        INITIAL_MEMBERS.forEach((initM) => {
          if (!finalMembers.some((m) => m.name.toLowerCase() === initM.name.toLowerCase())) {
            finalMembers.push(initM);
          }
        });

        // One-time programmatic reset for Asta to fix corrupted/bugged settings and zero him out
        const hasAstaReset = localStorage.getItem('studio_asta_reset_v3');
        if (!hasAstaReset) {
          localStorage.setItem('studio_asta_reset_v3', 'true');
          const astaIndex = finalMembers.findIndex((m) => m.name.toLowerCase() === 'asta');
          const cleanAsta: MemberData = {
            name: 'Asta',
            functions: [],
            chars: [],
            elements: [],
            artifacts: [],
            races: [],
            ingredients: [],
            forms: [],
            items: [],
            punishments: [],
            statsText: ASTA_STATS_DEFAULT,
            customBadge: 'Líder',
            customGlowColor: 'default',
            threatColor: 'default',
            mainStatsColor: 'default',
            kiCardColor: 'default',
            ipPartCardColor: 'default',
            temperatureCardColor: 'default',
            customBadgeColor: 'default',
            deaths: 0,
            bounty: 0,
            resets: 0,
            trueResets: 0,
            customCardSkin: 'none',
            avatarGlow: 'none'
          };
          if (astaIndex !== -1) {
            finalMembers[astaIndex] = cleanAsta;
          } else {
            finalMembers.push(cleanAsta);
          }
        }

        return sanitizeMembersList(finalMembers);
      } catch (e) {
        localStorage.setItem('studio_asta_reset_v3', 'true');
        return sanitizeMembersList(INITIAL_MEMBERS);
      }
    }
    localStorage.setItem('studio_asta_reset_v3', 'true');
    return sanitizeMembersList(INITIAL_MEMBERS);
  });

  const [activeView, setActiveView] = useState<'all' | 'sala' | 'members'>('all');

  const [roomData, setRoomData] = useState<RoomData>(() => {
    try {
      const saved = localStorage.getItem('studio_room_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_ROOM_DATA,
          ...parsed,
          effects: parsed.effects || DEFAULT_ROOM_DATA.effects,
          artifacts: parsed.artifacts || DEFAULT_ROOM_DATA.artifacts,
          boosters: parsed.boosters || DEFAULT_ROOM_DATA.boosters
        };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_ROOM_DATA;
  });

  useEffect(() => {
    localStorage.setItem('studio_room_data', JSON.stringify(roomData));
  }, [roomData]);

  const addRoomItem = (
  category: string,
  text: string,
  skinId: string = 'skin-default',
  rarityId: string = 'comum',
  quantity?: string,
  level?: string,
  borderStyle: string = 'default',
  customBorderColor: string = '',
  ornament: string = '') =>
  {
    if (!text || !text.trim()) return;
    const newItem: ItemData = {
      id: Math.random().toString(36).substr(2, 9),
      text: text.trim(),
      skinId: skinId || 'skin-default',
      rarityId: rarityId || 'comum',
      quantity,
      level,
      borderStyle,
      customBorderColor,
      ornament
    };
    setRoomData((prev) => ({
      ...prev,
      [category]: [newItem, ...(Array.isArray((prev as any)[category]) ? (prev as any)[category] : [])]
    }));
    addLog('SYSTEM', `Item "${text}" adicionado na Sala!`, 'success');
  };

  const removeRoomItem = (category: string, id: string) => {
    setRoomData((prev) => ({
      ...prev,
      [category]: (Array.isArray((prev as any)[category]) ? (prev as any)[category] : []).filter((item: any) => item.id !== id)
    }));
    addLog('SYSTEM', `Item removido da Sala!`, 'info');
  };

  const updateRoomItem = (category: string, id: string, data: any) => {
    setRoomData((prev) => ({
      ...prev,
      [category]: (Array.isArray((prev as any)[category]) ? (prev as any)[category] : []).map((item: any) => item.id === id ? { ...item, ...data } : item)
    }));
  };

  const addRoomEffect = (text: string, rarityId: string = 'comum', level: string = '1') => {
    const newEffect: RoomItemData = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      rarityId,
      level,
      type: 'Passivo',
      active: true
    };
    setRoomData((prev) => ({
      ...prev,
      effects: [newEffect, ...(prev.effects || [])]
    }));
    addLog('SYSTEM', `Efeito "${text}" (Lvl ${level}) adicionado à Sala!`, 'success');
  };

  const removeRoomEffect = (id: string) => {
    setRoomData((prev) => ({
      ...prev,
      effects: (prev.effects || []).filter((e) => e.id !== id)
    }));
    addLog('SYSTEM', `Efeito removido da Sala!`, 'info');
  };

  const toggleRoomEffectActive = (id: string) => {
    setRoomData((prev) => ({
      ...prev,
      effects: (prev.effects || []).map((e) => e.id === id ? { ...e, active: e.active === false ? true : false } : e)
    }));
  };

  const updateRoomEffectLevel = (id: string, newLevel: string) => {
    setRoomData((prev) => ({
      ...prev,
      effects: (prev.effects || []).map((e) => e.id === id ? { ...e, level: newLevel } : e)
    }));
  };

  const addRoomArtifact = (text: string, rarityId: string = 'comum', level: string = '1') => {
    const newArtifact: RoomItemData = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      rarityId,
      level
    };
    setRoomData((prev) => ({
      ...prev,
      artifacts: [newArtifact, ...(prev.artifacts || [])]
    }));
    addLog('SYSTEM', `Artefato "${text}" guardado na Sala!`, 'success');
  };

  const removeRoomArtifact = (id: string) => {
    setRoomData((prev) => ({
      ...prev,
      artifacts: (prev.artifacts || []).filter((a) => a.id !== id)
    }));
    addLog('SYSTEM', `Artefato removido da Sala!`, 'info');
  };

  const updateRoomArtifactLevel = (id: string, newLevel: string) => {
    setRoomData((prev) => ({
      ...prev,
      artifacts: (prev.artifacts || []).map((a) => a.id === id ? { ...a, level: newLevel } : a)
    }));
  };

  const addRoomBooster = (text: string, type: string = 'EXP', level: string = '1', rarityId: string = 'epico') => {
    const newBooster: RoomItemData = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      type,
      level,
      rarityId
    };
    setRoomData((prev) => ({
      ...prev,
      boosters: [newBooster, ...(prev.boosters || [])]
    }));
    addLog('SYSTEM', `Booster "${type}" (${level}) ativado na Sala!`, 'success');
  };

  const removeRoomBooster = (id: string) => {
    setRoomData((prev) => ({
      ...prev,
      boosters: (prev.boosters || []).filter((b) => b.id !== id)
    }));
    addLog('SYSTEM', `Booster removido da Sala!`, 'info');
  };

  const updateRoomBoosterLevel = (id: string, newLevel: string) => {
    setRoomData((prev) => ({
      ...prev,
      boosters: (prev.boosters || []).map((b) => b.id === id ? { ...b, level: newLevel } : b)
    }));
  };

  const updateRoomBoosterType = (id: string, newType: string) => {
    setRoomData((prev) => ({
      ...prev,
      boosters: (prev.boosters || []).map((b) => b.id === id ? { ...b, type: newType } : b)
    }));
  };

  const updateRoomSettings = (newSettings: Partial<RoomData>) => {
    setRoomData((prev) => ({
      ...prev,
      ...newSettings
    }));
  };

  const [showGlobalExportModal, setShowGlobalExportModal] = useState(false);
  const [selectedExportMemberName, setSelectedExportMemberName] = useState<string>('');

  const [logs, setLogs] = useState<{id: string;time: string;user: string;text: string;type: 'info' | 'error' | 'success';}[]>([]);
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('studio_discord_webhook') || process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL || '';
  });
  const [statsWebhookUrl, setStatsWebhookUrl] = useState(() => {
    return localStorage.getItem('studio_discord_stats_webhook') || process.env.NEXT_PUBLIC_DISCORD_STATS_WEBHOOK_URL || '';
  });
  const [roomWebhookUrl, setRoomWebhookUrl] = useState(() => {
    return localStorage.getItem('studio_discord_room_webhook') || process.env.NEXT_PUBLIC_DISCORD_ROOM_WEBHOOK_URL || '';
  });

  useEffect(() => {
    localStorage.setItem('studio_members', JSON.stringify(members));
    if (!localStorage.getItem('studio_migration_v2')) {
      localStorage.setItem('studio_migration_v2', 'true');
    }
  }, [members]);

  const addLog = (user: string, text: string, type: 'info' | 'error' | 'success' = 'info') => {
    const newLog = {
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      user,
      text,
      type
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 10));
  };

  const [snapshots, setSnapshots] = useState<{id: string;timestamp: string;members: MemberData[];label: string;}[]>(() => {
    try {
      const saved = localStorage.getItem('studio_members_snapshots');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [backupStatus, setBackupStatus] = useState<{text: string;isError: boolean;} | null>(null);

  useEffect(() => {
    localStorage.setItem('studio_members_snapshots', JSON.stringify(snapshots));
  }, [snapshots]);

  // Autosave a backup slot every time members change so they always have an automatic emergency restore point
  useEffect(() => {
    if (members && members.length > 0) {
      localStorage.setItem('studio_members_auto_emergency_backup', JSON.stringify(members));
    }
  }, [members]);

  const exportBackupJSON = () => {
    try {
      const dataStr = JSON.stringify({
        version: '3.1',
        timestamp: new Date().toISOString(),
        members,
        roomData,
        webhookUrl,
        statsWebhookUrl,
        roomWebhookUrl
      }, null, 2);
      let blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const exportFileDefaultName = `backup-painel-rpg-${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', url);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      URL.revokeObjectURL(url);

      addLog('SYSTEM', 'Backup baixado com sucesso como arquivo JSON!', 'success');
      setBackupStatus({ text: 'Backup exportado com sucesso!', isError: false });
      setTimeout(() => setBackupStatus(null), 4000);
    } catch (err) {
      setBackupStatus({ text: 'Erro ao exportar backup.', isError: true });
    }
  };

  const importBackupJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed && Array.isArray(parsed.members)) {
            setMembers(parsed.members);
            if (parsed.roomData) {
              setRoomData(parsed.roomData);
              localStorage.setItem('studio_room_data', JSON.stringify(parsed.roomData));
            }
            if (parsed.webhookUrl) {
              setWebhookUrl(parsed.webhookUrl);
              localStorage.setItem('studio_discord_webhook', parsed.webhookUrl);
            }
            if (parsed.statsWebhookUrl) {
              setStatsWebhookUrl(parsed.statsWebhookUrl);
              localStorage.setItem('studio_discord_stats_webhook', parsed.statsWebhookUrl);
            }
            if (parsed.roomWebhookUrl) {
              setRoomWebhookUrl(parsed.roomWebhookUrl);
              localStorage.setItem('studio_discord_room_webhook', parsed.roomWebhookUrl);
            }
            addLog('SYSTEM', 'Backup importado com sucesso!', 'success');
            setBackupStatus({ text: 'Backup importado e restaurado!', isError: false });
            setTimeout(() => setBackupStatus(null), 5000);
          } else {
            setBackupStatus({ text: 'Arquivo inválido (precisa conter membros).', isError: true });
          }
        } catch (err) {
          setBackupStatus({ text: 'Erro ao ler arquivo de backup.', isError: true });
        }
      };
    }
  };

  const createLocalSnapshot = (label: string = '') => {
    const now = new Date();
    const timeStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const finalLabel = label.trim() || `Snapshot #${snapshots.length + 1} (${timeStr.split(' ')[1]})`;

    const newSnapshot = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: timeStr,
      members: JSON.parse(JSON.stringify(members)),
      roomData: JSON.parse(JSON.stringify(roomData)),
      label: finalLabel
    };

    setSnapshots((prev) => [newSnapshot, ...prev].slice(0, 5));
    setSnapshotLabel('');
    addLog('SYSTEM', `Snapshot "${finalLabel}" criado localmente!`, 'success');
    setBackupStatus({ text: `Snapshot "${finalLabel}" criado!`, isError: false });
    setTimeout(() => setBackupStatus(null), 4000);
  };

  const restoreSnapshot = (id: string) => {
    const found = snapshots.find((s) => s.id === id);
    if (found) {
      setMembers(found.members);
      if ((found as any).roomData) {
        setRoomData((found as any).roomData);
      }
      addLog('SYSTEM', `Restaurado com sucesso do snapshot "${found.label}"!`, 'success');
      setBackupStatus({ text: `Restaurado de: ${found.label}`, isError: false });
      setTimeout(() => setBackupStatus(null), 4000);
    }
  };

  const restoreEmergencyBackup = () => {
    try {
      const emergency = localStorage.getItem('studio_members_auto_emergency_backup');
      if (emergency) {
        const parsed = JSON.parse(emergency);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMembers(parsed);
          addLog('SYSTEM', 'Restaurado com sucesso do auto-save de emergência!', 'success');
          setBackupStatus({ text: 'Restaurado do salvamento automático!', isError: false });
          setTimeout(() => setBackupStatus(null), 4000);
          return;
        }
      }
      setBackupStatus({ text: 'Nenhum auto-save encontrado.', isError: true });
    } catch {
      setBackupStatus({ text: 'Erro ao restaurar auto-save.', isError: true });
    }
  };

  const deleteSnapshot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
    addLog('SYSTEM', 'Snapshot local removido.', 'info');
  };

  const addItem = (
  memberName: string,
  category: 'functions' | 'chars' | 'elements' | 'artifacts' | 'races' | 'ingredients' | 'forms' | 'items',
  text: string,
  skinId: string,
  rarityId?: string,
  quantity?: string,
  level?: string,
  borderStyle?: string,
  customBorderColor?: string,
  ornament?: string) =>
  {
    if (!text.trim()) return;
    const newItem: ItemData = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      skinId,
      rarityId,
      quantity,
      level,
      borderStyle,
      customBorderColor,
      ornament
    };
    setMembers((prev) => prev.map((m) => {
      if (m.name === memberName) {
        const skinName = SKIN_LIST.find((s) => s.id === skinId)?.name;
        const rarityName = RARITY_LIST.find((r) => r.id === rarityId)?.name || 'Comum';
        const catLabel = category === 'functions' ? 'função' :
        category === 'chars' ? 'char' :
        category === 'elements' ? 'elemento' :
        category === 'artifacts' ? 'artefato' :
        category === 'races' ? 'raça' :
        category === 'ingredients' ? 'ingrediente' :
        category === 'items' ? 'item' : 'forma';
        const quantityLabel = quantity ? ` (${quantity})` : '';
        const levelLabel = level ? ` [Lvl ${category === 'races' ? level === '4' || level === 'MAX' ? 'MAX' : level : level === '3' || level === 'MAX' ? 'MAX' : level}]` : '';
        addLog(memberName, `adicionou ${catLabel}: ${text}${levelLabel}${quantityLabel} (Skin: ${skinName}, Faixa: ${rarityName})`);
        const currentList = m[category] || [];
        return { ...m, [category]: [...currentList, newItem] };
      }
      return m;
    }));
  };

  const removeItem = (
  memberName: string,
  category: 'functions' | 'chars' | 'elements' | 'artifacts' | 'races' | 'ingredients' | 'forms' | 'items',
  id: string) =>
  {
    setMembers((prev) => prev.map((m) => {
      if (m.name === memberName) {
        const currentList = m[category] || [];
        const itemToRemove = currentList.find((i) => i.id === id);
        const skinName = SKIN_LIST.find((s) => s.id === itemToRemove?.skinId)?.name;
        const catLabel = category === 'functions' ? 'função' :
        category === 'chars' ? 'char' :
        category === 'elements' ? 'elemento' :
        category === 'artifacts' ? 'artefato' :
        category === 'races' ? 'raça' :
        category === 'ingredients' ? 'ingrediente' :
        category === 'items' ? 'item' : 'forma';
        addLog(memberName, `removeu ${catLabel}: ${itemToRemove?.text} (Skin: ${skinName})`);
        return { ...m, [category]: currentList.filter((i) => i.id !== id) };
      }
      return m;
    }));
  };

  const updateItem = (
  memberName: string,
  category: 'functions' | 'chars' | 'elements' | 'artifacts' | 'races' | 'ingredients' | 'forms' | 'items',
  id: string,
  updatedData: Partial<ItemData>) =>
  {
    setMembers((prev) => prev.map((m) => {
      if (m.name === memberName) {
        const currentList = m[category] || [];
        const updatedList = currentList.map((item) => {
          if (item.id === id) {
            const merged = { ...item, ...updatedData };
            const skinName = SKIN_LIST.find((s) => s.id === merged.skinId)?.name;
            const catLabel = category === 'functions' ? 'função' :
            category === 'chars' ? 'char' :
            category === 'elements' ? 'elemento' :
            category === 'artifacts' ? 'artefato' :
            category === 'races' ? 'raça' :
            category === 'ingredients' ? 'ingrediente' :
            category === 'items' ? 'item' : 'forma';
            const levelLabel = merged.level ? ` [Lvl ${category === 'races' ? merged.level === '4' || merged.level === 'MAX' ? 'MAX' : merged.level : merged.level === '3' || merged.level === 'MAX' ? 'MAX' : merged.level}]` : '';
            addLog(memberName, `editou localmente ${catLabel}: ${item.text} ➔ ${merged.text}${levelLabel} (Skin: ${skinName})`);
            return merged;
          }
          return item;
        });
        return { ...m, [category]: updatedList };
      }
      return m;
    }));
  };

  const addPunishment = (memberName: string, type: 'warning' | 'expulsion', reason: string) => {
    if (!reason.trim()) return;
    const newPunishment: Punishment = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      reason,
      date: new Date().toLocaleDateString('pt-BR')
    };
    setMembers((prev) => prev.map((m) => {
      if (m.name === memberName) {
        addLog('SYSTEM', `Punição (${type}) aplicada a ${memberName}`, type === 'expulsion' ? 'error' : 'info');
        return { ...m, punishments: [...m.punishments, newPunishment] };
      }
      return m;
    }));
  };

  const removePunishment = (memberName: string, id: string) => {
    setMembers((prev) => prev.map((m) => {
      if (m.name === memberName) {
        addLog('SYSTEM', `Punição removida de ${memberName}`, 'success');
        return { ...m, punishments: m.punishments.filter((p) => p.id !== id) };
      }
      return m;
    }));
  };

  const updateStatsText = (memberName: string, text: string) => {
    setMembers((prev) => prev.map((m) => {
      if (m.name === memberName) {
        addLog(memberName, `atualizou as estatísticas.`);
        return { ...m, statsText: text || undefined };
      }
      return m;
    }));
  };

  const updateCustomSettings = (memberName: string, updates: Partial<MemberData>) => {
    setMembers((prev) => {
      const updated = prev.map((m) => {
        if (m.name === memberName) {
          return { ...m, ...updates };
        }
        return m;
      });
      return sanitizeMembersList(updated);
    });
  };

  const removeMember = (memberName: string) => {
    setMembers((prev) => prev.filter((m) => m.name !== memberName));
    addLog('SYSTEM', `Removeu o card de ${memberName}`, 'error');
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 flex flex-col gap-6 max-w-[1400px] mx-auto overflow-x-hidden">
      {/* Header Section */}
      <header className="glass-panel flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 font-bold text-xl text-white">S</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase">
              STUDIO PANEL <span className="text-indigo-400 text-sm font-normal ml-2 tracking-widest font-mono">v2.5.0</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-tighter font-bold">Management & Administrative Control</p>
          </div>
        </div>
        <div className="hidden md:flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">System Status</span>
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              All Systems Operational
            </span>
          </div>
        </div>
      </header>

      {/* Navigation & View Selection Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-indigo-500/20 p-2.5 rounded-2xl flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
            activeView === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-850'}`
            }>
            
            <Layers size={14} />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveView('sala')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
            activeView === 'sala' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25' : 'bg-slate-950 text-purple-300 hover:text-white hover:bg-purple-950/60'}`
            }>
            
            <Castle size={14} className="text-purple-400" />
            <span>🏛️ Sala de Comando</span>
            <span className="bg-purple-950 text-purple-300 text-[9px] px-1.5 py-0.2 rounded border border-purple-800 font-mono">
              Central
            </span>
          </button>

          <button
            onClick={() => setActiveView('members')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
            activeView === 'members' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-850'}`
            }>
            
            <Users size={14} />
            <span>👥 Membros ({members.length})</span>
          </button>

          <button
            onClick={() => {
              if (!selectedExportMemberName && members.length > 0) {
                setSelectedExportMemberName(members[0].name);
              }
              setShowGlobalExportModal(true);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1.5 cursor-pointer bg-slate-950 text-cyan-300 hover:text-white hover:bg-cyan-950/60 border border-cyan-500/30 hover:border-cyan-400 shadow-sm active:scale-95"
            title="Abrir Pré-Imagem das Estatísticas & Exportar para o Discord">
            
            <Camera size={14} className="text-cyan-400" />
            <span>📸 Pré-Imagem / Exportar</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-slate-500 hidden lg:block">
          {activeView === 'all' && 'Exibindo Sala de Comando + Membros do Clã'}
          {activeView === 'sala' && 'Exibindo Painel Expandido da Sala de Comando'}
          {activeView === 'members' && 'Exibindo Fichas dos Membros'}
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1">
        {/* Main Content Area (8 cols or 12 cols depending on active view) */}
        <div className={`${activeView === 'sala' ? 'md:col-span-12' : 'md:col-span-8'} flex flex-col gap-6`}>
          {/* Room Card rendered in 'all' or 'sala' views */}
          {(activeView === 'all' || activeView === 'sala') &&
          <RoomCard
            roomData={roomData}
            onUpdateRoomSettings={updateRoomSettings}
            onAddRoomItem={addRoomItem}
            onRemoveRoomItem={removeRoomItem}
            onUpdateRoomItem={updateRoomItem}
            onAddEffect={addRoomEffect}
            onRemoveEffect={removeRoomEffect}
            onToggleEffectActive={toggleRoomEffectActive}
            onUpdateEffectLevel={updateRoomEffectLevel}
            onAddArtifact={addRoomArtifact}
            onRemoveArtifact={removeRoomArtifact}
            onUpdateArtifactLevel={updateRoomArtifactLevel}
            onAddBooster={addRoomBooster}
            onRemoveBooster={removeRoomBooster}
            onUpdateBoosterLevel={updateRoomBoosterLevel}
            onUpdateBoosterType={updateRoomBoosterType}
            onAddLog={addLog}
            webhookUrl={webhookUrl}
            statsWebhookUrl={statsWebhookUrl}
            roomWebhookUrl={roomWebhookUrl}
            isExpandedView={activeView === 'sala'}
            onToggleExpand={() => setActiveView(activeView === 'sala' ? 'all' : 'sala')} />

          }

          {/* Members Cards Grid rendered in 'all' or 'members' views */}
          {(activeView === 'all' || activeView === 'members') &&
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {members.map((member) =>
            <MemberCard
              key={member.name}
              member={member}
              onAddItem={addItem}
              onRemoveItem={removeItem}
              onUpdateItem={updateItem}
              onAddPunishment={addPunishment}
              onRemovePunishment={removePunishment}
              onUpdateStatsText={updateStatsText}
              onUpdateCustomSettings={updateCustomSettings}
              onRemoveMember={removeMember}
              onAddLog={addLog}
              webhookUrl={webhookUrl}
              statsWebhookUrl={statsWebhookUrl}
              onOpenExportModal={(name: string) => {
                setSelectedExportMemberName(name);
                setShowGlobalExportModal(true);
              }} />

            )}
            </div>
          }
        </div>

        {/* Sidebar Column (4 cols) - Hidden when viewing full expanded Sala view */}
        {activeView !== 'sala' &&
        <div className="md:col-span-4 flex flex-col gap-6">
            {/* Settings Card */}
            <div className="bento-card bg-slate-900/80 border-indigo-500/20">
            <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-widest flex items-center justify-between">
              <span className="flex items-center gap-2 text-indigo-400">
                <ShieldAlert size={14} />
                Configurações
              </span>
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Webhook Geral (Painel)</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className="input-bento h-9 text-[11px] font-mono"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={webhookUrl}
                    onChange={(e) => {
                      setWebhookUrl(e.target.value);
                      localStorage.setItem('studio_discord_webhook', e.target.value);
                    }} />
                  
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-800/40 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">Webhook Sala Central (Solo)</label>
                  <span className="text-[8px] bg-purple-950 text-purple-300 border border-purple-800/50 px-1 py-0.2 rounded font-bold">SOLO</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className="input-bento h-9 text-[11px] font-mono border-purple-500/20 focus:border-purple-500/60 focus:ring-purple-500/30"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={roomWebhookUrl}
                    onChange={(e) => {
                      setRoomWebhookUrl(e.target.value);
                      localStorage.setItem('studio_discord_room_webhook', e.target.value);
                    }} />
                  
                </div>
                <p className="text-[9px] text-slate-600 leading-tight italic">
                  Canal exclusivo para o card e status da Sala Central. Se vazio, usará o Webhook Geral.
                </p>
              </div>

              <div className="space-y-2 border-t border-slate-800/40 pt-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Webhook RPG (Estatísticas)</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className="input-bento h-9 text-[11px] font-mono"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={statsWebhookUrl}
                    onChange={(e) => {
                      setStatsWebhookUrl(e.target.value);
                      localStorage.setItem('studio_discord_stats_webhook', e.target.value);
                    }} />
                  
                </div>
                <p className="text-[9px] text-slate-600 leading-tight italic">
                  Usado especificamente para enviar a ficha de status formatada.
                </p>
              </div>

              <div className="space-y-2 border-t border-slate-800/40 pt-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Criar Novo Card (Membro)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="new-member-name-input"
                    className="input-bento h-9 text-[11px] flex-1"
                    placeholder="Nome do novo membro..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          const newMember: MemberData = {
                            name: val,
                            functions: [],
                            chars: [],
                            elements: [],
                            artifacts: [],
                            races: [],
                            ingredients: [],
                            forms: [],
                            items: [],
                            punishments: [],
                            statsText: `Estatísticas Atuais.\n${val}\n➳ Nivel = 1\n➳ Exp = 0\n➳ Classe = D`,
                            customBadge: 'Membro',
                            customGlowColor: 'default',
                            customCardSkin: 'none',
                            deaths: 0
                          };
                          setMembers((prev) => [...prev, newMember]);
                          addLog('SYSTEM', `Card de ${val} adicionado ao painel!`, 'success');
                          e.currentTarget.value = '';
                        }
                      }
                    }} />
                  
                  <button
                    onClick={() => {
                      const input = document.getElementById('new-member-name-input') as HTMLInputElement;
                      const val = input?.value.trim();
                      if (val) {
                        const newMember: MemberData = {
                          name: val,
                          functions: [],
                          chars: [],
                          elements: [],
                          artifacts: [],
                          races: [],
                          ingredients: [],
                          forms: [],
                          items: [],
                          punishments: [],
                          statsText: `Estatísticas Atuais.\n${val}\n➳ Nivel = 1\n➳ Exp = 0\n➳ Classe = D`,
                          customBadge: 'Membro',
                          customGlowColor: 'default',
                          customCardSkin: 'none',
                          deaths: 0
                        };
                        setMembers((prev) => [...prev, newMember]);
                        addLog('SYSTEM', `Card de ${val} adicionado ao painel!`, 'success');
                        if (input) input.value = '';
                      }
                    }}
                    className="h-9 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95 shrink-0">
                    
                    Criar
                  </button>
                </div>
              </div>

              {/* Seção de Backup e Restauração (Segurança Extra) */}
              <div className="space-y-3 border-t border-slate-800/40 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Backup e Restauração</label>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900 font-bold uppercase tracking-wider animate-pulse">PRO PRESERV</span>
                </div>
                
                {/* Friendly explanation about browser environment */}
                <p className="text-[9px] text-slate-500 leading-tight">
                  Como este painel roda em um sandbox de desenvolvimento, o navegador pode ocasionalmente limpar seus dados. Use as opções abaixo para se prevenir!
                </p>

                {/* Main Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={exportBackupJSON}
                    className="h-8 px-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-lg text-[9px] font-bold uppercase flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-slate-700/50"
                    title="Baixar backup completo de todos os personagens e itens como JSON">
                    
                    <Download size={11} className="text-emerald-400" />
                    <span>Baixar JSON</span>
                  </button>

                  <label className="h-8 px-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-lg text-[9px] font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-slate-700/50 text-center">
                    <Upload size={11} className="text-cyan-400" />
                    <span>Carregar JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={importBackupJSON}
                      className="hidden" />
                    
                  </label>
                </div>

                {/* Emergency Auto-Save restoration */}
                <div className="pt-1">
                  <button
                    onClick={restoreEmergencyBackup}
                    className="w-full h-8 px-2.5 bg-indigo-950/40 hover:bg-indigo-950/60 text-indigo-300 rounded-lg text-[9px] font-bold uppercase flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-indigo-900/40"
                    title="Tentar recuperar dados salvos automaticamente na última alteração feita">
                    
                    <RefreshCw size={11} className="text-indigo-400 animate-pulse" />
                    <span>Auto-Save Emergência</span>
                  </button>
                </div>

                {/* Create snap slot */}
                <div className="space-y-1.5 pt-1.5 border-t border-slate-800/20">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Snapshots Salvos (Slots Locais)</span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      className="input-bento h-8 text-[10px] flex-1"
                      placeholder="Nome do snapshot (opcional)..."
                      value={snapshotLabel}
                      onChange={(e) => setSnapshotLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          createLocalSnapshot(snapshotLabel);
                        }
                      }} />
                    
                    <button
                      onClick={() => createLocalSnapshot(snapshotLabel)}
                      className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-bold uppercase flex items-center justify-center gap-1 transition-all active:scale-95 shrink-0">
                      
                      <Save size={11} />
                      <span>Salvar</span>
                    </button>
                  </div>
                </div>

                {/* Snapshots lists */}
                {snapshots.length > 0 &&
                <div className="space-y-1 max-h-[110px] overflow-y-auto pr-1 custom-scrollbar pt-1">
                    {snapshots.map((snap) =>
                  <div
                    key={snap.id}
                    onClick={() => restoreSnapshot(snap.id)}
                    className="group flex items-center justify-between p-1.5 rounded-md bg-slate-900 border border-slate-800/60 hover:border-indigo-500/30 text-left cursor-pointer transition-all hover:bg-indigo-950/20"
                    title="Clique para restaurar este snapshot">
                    
                        <div className="truncate flex-1 pr-2">
                          <div className="text-[9px] font-bold text-slate-300 group-hover:text-indigo-300 truncate">
                            {snap.label}
                          </div>
                          <div className="text-[8px] font-mono text-slate-600">
                            {snap.timestamp}
                          </div>
                        </div>
                        <button
                      onClick={(e) => deleteSnapshot(snap.id, e)}
                      className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-950/20 rounded transition-all shrink-0"
                      title="Excluir este snapshot">
                      
                          <Trash2 size={10} />
                        </button>
                      </div>
                  )}
                  </div>
                }

                {/* Backup feedback status message */}
                {backupStatus &&
                <div
                  className={`p-1.5 rounded text-[9px] font-bold text-center ${
                  backupStatus.isError ? 'bg-red-950/40 text-red-400 border border-red-900/30' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'}`
                  }>
                  
                    {backupStatus.text}
                  </div>
                }
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bento-card flex-1 min-h-[300px]">
            <h3 className="text-xs font-bold text-slate-500 mb-6 uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} />
              Histórico Recente
            </h3>
            <div className="space-y-4 font-mono text-[11px]">
              {logs.length === 0 &&
              <div className="text-slate-700 italic border border-dashed border-slate-800 rounded-xl p-4 text-center">
                  Aguardando atividades...
                </div>
              }
              {logs.map((log) =>
              <div key={log.id} className="flex gap-3 pb-3 border-b border-slate-800/50">
                  <span className="text-slate-600 shrink-0">{log.time}</span>
                  <span className={`shrink-0 font-bold ${
                log.user === 'SYSTEM' ? 'text-rose-500' :
                log.user === 'Asta' ? 'text-indigo-400' :
                log.user === 'Afogz' ? 'text-cyan-400' : 'text-emerald-400'}`
                }>{log.user}</span>
                  <span className={`truncate ${log.type === 'error' ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                    {log.text}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-auto pt-6">
              <div className="bg-indigo-900/10 border border-indigo-500/10 p-4 rounded-2xl">
                <p className="text-[10px] text-indigo-400/80 italic leading-relaxed">
                  "A administração reserva o direito de monitorar todas as ações registradas neste painel."
                </p>
              </div>
            </div>
          </div>
        </div>
        }
      </div>

      <GlobalExportModal
        isOpen={showGlobalExportModal}
        onClose={() => setShowGlobalExportModal(false)}
        members={members}
        selectedMemberName={selectedExportMemberName || members[0]?.name || ''}
        onSelectMember={(name) => setSelectedExportMemberName(name)}
        statsWebhookUrl={statsWebhookUrl}
        webhookUrl={webhookUrl} />
      
    </div>);

}

const getThreatValue = (statsText: string): string => {
  if (!statsText) return '';
  const match = statsText.match(/➳\s*Ameaça\s*[=:]\s*([^\n]*)/i) || statsText.match(/Ameaça\s*[=:]\s*([^\n]*)/i);
  return match ? match[1].trim() : '';
};

const updateThreatValue = (statsText: string, newValue: string): string => {
  if (!statsText) return `➳ Ameaça = ${newValue}`;
  if (statsText.match(/➳\s*Ameaça\s*[=:]/i)) {
    return statsText.replace(/(➳\s*Ameaça\s*[=:]\s*)([^\n]*)/i, `$1${newValue}`);
  } else if (statsText.match(/Ameaça\s*[=:]/i)) {
    return statsText.replace(/(Ameaça\s*[=:]\s*)([^\n]*)/i, `$1${newValue}`);
  } else {
    return statsText + `\n➳ Ameaça = ${newValue}`;
  }
};

const parseStats = (text: string) => {
  if (!text) return [];
  return text.split('\n').map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return { id: idx, type: 'empty' };
    if (trimmed.startsWith('-------------') || trimmed.includes('===')) {
      return { id: idx, type: 'divider' };
    }
    if (trimmed.toLowerCase().includes('estatísticas atuais') || trimmed.toLowerCase() === 'nkleozin' || trimmed.toLowerCase() === 'asta' || trimmed.toLowerCase() === 'afogz') {
      return { id: idx, type: 'header', text: trimmed };
    }

    // Match something like "➳ label = value" or "➳ label: value" or "label: value"
    const match = trimmed.match(/^(?:➳\s*)?([^=:]+)(?:[=:])\s*(.*)$/);
    if (match) {
      const label = match[1].trim();
      if (label.toLowerCase() === 'retsu') {
        return { id: idx, type: 'empty' };
      }
      return {
        id: idx,
        type: 'stat',
        label: label,
        value: match[2].trim()
      };
    }
    return { id: idx, type: 'text', text: trimmed };
  });
};

// HELPER MAPS FOR CUSTOMIZABLE DEATHS SCOREBOARD & ROOM CARD
const NAME_FONTS: Record<string, string> = {
  orbitron: '"Orbitron", sans-serif',
  cinzel: '"Cinzel", serif',
  marker: '"Permanent Marker", cursive',
  playfair: '"Playfair Display", serif',
  mono: '"JetBrains Mono", monospace',
  sans: '"Inter", sans-serif',
  outfit: '"Outfit", sans-serif',
  creepster: '"Creepster", system-ui',
  retro: '"Press Start 2P", monospace'
};

const GLOW_CLASSES: Record<string, string> = {
  default: '',
  purple: 'shadow-[0_0_25px_rgba(168,85,247,0.35)]',
  crimson: 'shadow-[0_0_25px_rgba(239,68,68,0.35)]',
  cyan: 'shadow-[0_0_25px_rgba(6,182,212,0.35)]',
  gold: 'shadow-[0_0_25px_rgba(245,158,11,0.35)]',
  emerald: 'shadow-[0_0_25px_rgba(16,185,129,0.35)]',
  pink: 'shadow-[0_0_25px_rgba(244,114,182,0.35)]',
  cosmic: 'shadow-[0_0_30px_rgba(168,85,247,0.4)]',
  'cosmic-purple': 'shadow-[0_0_30px_rgba(168,85,247,0.4)]',
  'hellfire': 'shadow-[0_0_30px_rgba(239,68,68,0.4)]',
  'cyber-cyan': 'shadow-[0_0_30px_rgba(6,182,212,0.4)]',
  'divine-gold': 'shadow-[0_0_30px_rgba(245,158,11,0.4)]',
  'emerald-toxic': 'shadow-[0_0_30px_rgba(16,185,129,0.4)]'
};

const SKIN_CLASSES: Record<string, string> = new Proxy(
  {
    'cosmic-purple': 'border-purple-500/50 bg-gradient-to-br from-purple-950/40 via-slate-950/70 to-fuchsia-950/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]',
    'hellfire-red': 'border-red-500/50 bg-gradient-to-br from-red-950/40 via-slate-950/70 to-orange-950/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    'divine-gold': 'border-amber-500/50 bg-gradient-to-br from-amber-950/40 via-slate-950/70 to-yellow-950/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
    'cyber-cyan': 'border-cyan-500/50 bg-gradient-to-br from-cyan-950/40 via-slate-950/70 to-blue-950/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]',
    'emerald-toxic': 'border-emerald-500/50 bg-gradient-to-br from-emerald-950/40 via-slate-950/70 to-teal-950/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    'hyper-pink': 'border-pink-500/50 bg-gradient-to-br from-pink-950/40 via-slate-950/70 to-rose-950/30 shadow-[0_0_15px_rgba(244,114,182,0.2)]',
    default: 'border-slate-800 bg-slate-900/80'
  },
  {
    get(target: Record<string, string>, prop: string) {
      if (prop in target) return target[prop];
      const skinObj = SKIN_LIST.find((s) => s.id === prop);
      if (skinObj) return `${skinObj.class} border-slate-700/50 bg-slate-900/90`;
      const cardSkin = getCardSkinClasses(prop);
      return `${cardSkin.border} ${cardSkin.bg}`;
    }
  }
);

const DEATHS_ICONS: Record<string, any> = {
  skull: Skull,
  ghost: Ghost,
  heart: Heart,
  flame: Flame,
  sword: Sword,
  shield: Shield,
  star: Star,
  crown: Crown
};

const DEATHS_FONTS: Record<string, string> = {
  sans: '"Inter", sans-serif',
  mono: '"JetBrains Mono", monospace',
  orbitron: '"Orbitron", sans-serif',
  marker: '"Permanent Marker", cursive',
  cinzel: '"Cinzel", serif',
  playfair: '"Playfair Display", serif',
  outfit: '"Outfit", sans-serif',
  creepster: '"Creepster", system-ui',
  retro: '"Press Start 2P", monospace'
};

const DEATHS_GRADIENTS: Record<string, {container: string;icon: string;label: string;number: string;}> = {
  'crimson-hellfire': {
    container: 'bg-red-950/45 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)] hover:border-red-500/60 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]',
    icon: 'text-red-500 animate-pulse',
    label: 'text-red-400',
    number: 'text-red-500 filter drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]'
  },
  'cosmic-violet': {
    container: 'bg-purple-950/45 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)] hover:border-purple-500/60 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]',
    icon: 'text-purple-400 animate-pulse',
    label: 'text-purple-300',
    number: 'text-purple-400 filter drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]'
  },
  'toxic-acid': {
    container: 'bg-lime-950/45 border-lime-500/40 shadow-[0_0_12px_rgba(132,204,22,0.25)] hover:border-lime-500/60 hover:shadow-[0_0_15px_rgba(132,204,22,0.4)]',
    icon: 'text-lime-400 animate-pulse',
    label: 'text-lime-300',
    number: 'text-lime-400 filter drop-shadow-[0_0_6px_rgba(132,204,22,0.8)]'
  },
  'gold-royal': {
    container: 'bg-amber-950/45 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:border-amber-500/60 hover:shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    icon: 'text-amber-400 animate-pulse',
    label: 'text-amber-300',
    number: 'text-amber-400 filter drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]'
  }
};

const THREAT_STYLES: Record<string, {card: string;label: string;value: string;ping: string;thumbnail?: string;}> = {
  'default': {
    card: 'border-slate-800/80 bg-slate-950/50 hover:border-indigo-500/40 shadow-inner',
    label: 'text-indigo-400 font-extrabold tracking-widest',
    value: 'text-indigo-300 font-extrabold group-hover/stat:text-white',
    ping: 'bg-indigo-400'
  },
  'lowers': {
    card: 'border-black bg-slate-950 shadow-inner hover:border-slate-800',
    label: 'text-slate-500 font-extrabold tracking-widest',
    value: 'text-slate-300 font-extrabold group-hover/stat:text-white',
    ping: 'bg-slate-400',
    thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_17636b975-1772153622859.png"
  },
  'intermediate': {
    card: 'border-sky-500/70 border-dashed border-2 bg-slate-900/60 shadow-[0_0_8px_rgba(14,165,233,0.15)] hover:border-sky-400',
    label: 'text-sky-400 font-extrabold tracking-widest',
    value: 'text-sky-300 font-bold group-hover/stat:text-sky-200',
    ping: 'bg-sky-400',
    thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_18670ae85-1774281356967.png"
  },
  'hoher-rang': {
    card: 'border-red-600 bg-gradient-to-br from-orange-950/50 via-slate-950/80 to-red-950/50 shadow-[0_0_12px_rgba(239,68,68,0.25)] hover:border-red-500',
    label: 'text-orange-400 font-extrabold tracking-widest',
    value: 'text-red-400 font-black drop-shadow-[0_0_5px_rgba(239,68,68,0.6)] group-hover/stat:text-red-300',
    ping: 'bg-red-500',
    thumbnail: "https://images.unsplash.com/photo-1695989599211-6824e05ed08e"
  },
  'zusatzlich': {
    card: 'border-amber-500 bg-white shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:border-amber-400',
    label: 'text-amber-600 font-extrabold tracking-widest',
    value: 'text-slate-900 font-black',
    ping: 'bg-amber-500',
    thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_18caa19e5-1776328445079.png"
  }
};

const MAIN_STAT_STYLES: Record<string, {card: string;label: string;value: string;}> = {
  'default': {
    card: 'border-slate-800/80 hover:border-indigo-500/40 bg-slate-950/50',
    label: 'text-slate-500',
    value: 'text-indigo-300 group-hover/stat:text-white'
  },
  'cyber-cyan': {
    card: 'border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 via-slate-950/70 to-blue-950/20 shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:border-cyan-400',
    label: 'text-cyan-400 font-extrabold',
    value: 'text-cyan-300 font-extrabold drop-shadow-[0_0_5px_rgba(34,211,238,0.6)] group-hover/stat:text-cyan-100'
  },
  'cosmic-purple': {
    card: 'border-purple-500/40 bg-gradient-to-br from-purple-950/30 via-slate-950/70 to-fuchsia-950/20 shadow-[0_0_10px_rgba(168,85,247,0.2)] hover:border-purple-400',
    label: 'text-purple-400 font-extrabold',
    value: 'text-fuchsia-300 font-extrabold drop-shadow-[0_0_5px_rgba(217,70,239,0.6)] group-hover/stat:text-fuchsia-100'
  },
  'hellfire-red': {
    card: 'border-red-500/40 bg-gradient-to-br from-red-950/30 via-slate-950/70 to-orange-950/20 shadow-[0_0_10px_rgba(239,68,68,0.2)] hover:border-red-400',
    label: 'text-red-400 font-extrabold',
    value: 'text-orange-300 font-extrabold drop-shadow-[0_0_5px_rgba(249,115,22,0.6)] group-hover/stat:text-orange-100'
  },
  'divine-gold': {
    card: 'border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-slate-950/70 to-yellow-950/20 shadow-[0_0_10px_rgba(245,158,11,0.2)] hover:border-amber-400',
    label: 'text-amber-400 font-extrabold',
    value: 'text-yellow-300 font-extrabold drop-shadow-[0_0_5px_rgba(234,179,8,0.6)] group-hover/stat:text-yellow-100'
  },
  'emerald-toxic': {
    card: 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-slate-950/70 to-teal-950/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:border-emerald-400',
    label: 'text-emerald-400 font-extrabold',
    value: 'text-emerald-300 font-extrabold drop-shadow-[0_0_5px_rgba(52,211,153,0.6)] group-hover/stat:text-emerald-100'
  },
  'hyper-pink': {
    card: 'border-pink-500/40 bg-gradient-to-br from-pink-950/30 via-slate-950/70 to-rose-950/20 shadow-[0_0_10px_rgba(244,114,182,0.2)] hover:border-pink-400',
    label: 'text-pink-400 font-extrabold',
    value: 'text-pink-300 font-extrabold drop-shadow-[0_0_5px_rgba(244,114,182,0.6)] group-hover/stat:text-pink-100'
  },
  'ocean-blue': {
    card: 'border-blue-500/40 bg-gradient-to-br from-blue-950/30 via-slate-950/70 to-sky-950/20 shadow-[0_0_10px_rgba(59,130,246,0.2)] hover:border-blue-400',
    label: 'text-sky-400 font-extrabold',
    value: 'text-blue-300 font-extrabold drop-shadow-[0_0_5px_rgba(59,130,246,0.6)] group-hover/stat:text-sky-100'
  },
  'magma-orange': {
    card: 'border-orange-500/40 bg-gradient-to-br from-orange-950/30 via-slate-950/70 to-red-950/20 shadow-[0_0_10px_rgba(249,115,22,0.2)] hover:border-orange-400',
    label: 'text-orange-400 font-extrabold',
    value: 'text-amber-300 font-extrabold drop-shadow-[0_0_5px_rgba(251,146,60,0.6)] group-hover/stat:text-amber-100'
  },
  'rainbow-prism': {
    card: 'border-pink-500/40 bg-gradient-to-br from-slate-950/90 via-purple-950/30 to-pink-950/30 shadow-[0_0_10px_rgba(236,72,153,0.2)] hover:border-pink-400',
    label: 'bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent font-extrabold',
    value: 'bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent font-extrabold filter drop-shadow-[0_0_4px_rgba(168,85,247,0.5)]'
  },
  'obsidian-dark': {
    card: 'border-slate-700/50 bg-slate-950/80 shadow-[0_0_8px_rgba(255,255,255,0.05)] hover:border-slate-500',
    label: 'text-slate-400 font-extrabold',
    value: 'text-slate-200 font-bold group-hover/stat:text-white'
  },
  'aurora': {
    card: 'border-emerald-400/50 bg-gradient-to-br from-emerald-950/40 via-teal-950/40 to-indigo-950/40 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:border-emerald-300',
    label: 'bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 bg-clip-text text-transparent font-extrabold',
    value: 'bg-gradient-to-r from-emerald-300 via-teal-300 to-indigo-300 bg-clip-text text-transparent font-extrabold filter drop-shadow-[0_0_5px_rgba(52,211,153,0.7)] group-hover/stat:brightness-110'
  },
  'vaporwave': {
    card: 'border-pink-500/50 bg-gradient-to-br from-pink-950/35 via-fuchsia-950/40 to-cyan-950/35 shadow-[0_0_10px_rgba(236,72,153,0.25)] hover:border-pink-400',
    label: 'bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent font-extrabold',
    value: 'bg-gradient-to-r from-pink-300 to-cyan-300 bg-clip-text text-transparent font-bold drop-shadow-[0_0_6px_rgba(236,72,153,0.5)]'
  },
  'frost-ice': {
    card: 'border-sky-400/50 bg-gradient-to-br from-sky-950/40 via-slate-950/80 to-cyan-950/40 shadow-[0_0_10px_rgba(56,189,248,0.25)] hover:border-sky-300',
    label: 'text-sky-400 font-extrabold',
    value: 'text-cyan-200 font-bold drop-shadow-[0_0_5px_rgba(56,189,248,0.6)] group-hover/stat:text-white'
  },
  'abyss-void': {
    card: 'border-indigo-900/60 bg-gradient-to-br from-indigo-950/50 via-slate-950/90 to-purple-950/50 shadow-[0_0_10px_rgba(99,102,241,0.15)] hover:border-indigo-500/50',
    label: 'text-indigo-400 font-extrabold',
    value: 'text-purple-300 font-bold drop-shadow-[0_0_4px_rgba(168,85,247,0.4)] group-hover/stat:text-white'
  },
  'plasma-purple': {
    card: 'border-fuchsia-500/50 bg-gradient-to-br from-purple-950/40 via-violet-950/60 to-cyan-950/30 shadow-[0_0_10px_rgba(192,38,211,0.25)] hover:border-fuchsia-400',
    label: 'text-fuchsia-400 font-extrabold',
    value: 'text-cyan-300 font-bold drop-shadow-[0_0_6px_rgba(6,182,212,0.6)] group-hover/stat:text-white'
  },
  'corrupted': {
    card: 'border-red-600/50 bg-gradient-to-br from-red-950/40 via-neutral-950 to-emerald-950/40 shadow-[0_0_10px_rgba(220,38,38,0.25)] hover:border-red-500',
    label: 'text-emerald-500 font-extrabold',
    value: 'text-red-400 font-bold drop-shadow-[0_0_5px_rgba(220,38,38,0.6)] group-hover/stat:text-white'
  }
};

const NAME_GRADIENTS: Record<string, string> = {
  default: 'text-white drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.5)]',
  'sunset-fire': 'bg-gradient-to-r from-orange-400 via-amber-500 to-red-500 bg-clip-text text-transparent font-black filter drop-shadow-[0_2px_4px_rgba(239,68,68,0.35)]',
  'nebula-aurora': 'bg-gradient-to-r from-fuchsia-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent font-black filter drop-shadow-[0_2px_4px_rgba(168,85,247,0.4)]',
  'acid-green': 'bg-gradient-to-r from-lime-400 to-emerald-500 bg-clip-text text-transparent font-black filter drop-shadow-[0_2px_4px_rgba(16,185,129,0.35)]',
  'royal-gold': 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 bg-clip-text text-transparent font-black filter drop-shadow-[0_2px_4px_rgba(245,158,11,0.45)]',
  'electric-cyan': 'bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-black filter drop-shadow-[0_2px_4px_rgba(6,182,212,0.4)]',
  'vampire-gaze': 'bg-gradient-to-r from-red-600 via-rose-600 to-rose-900 bg-clip-text text-transparent font-black filter drop-shadow-[0_2px_4px_rgba(225,29,72,0.45)]',
  'chrome-metallic': 'bg-gradient-to-r from-slate-400 via-slate-100 to-slate-400 bg-clip-text text-transparent font-black filter drop-shadow-[0_2px_4px_rgba(255,255,255,0.25)]'
};

const AVATAR_GLOWS: Record<string, {
  container: string;
  imgWrapper: string;
  extraElement?: React.ReactNode;
}> = {
  none: {
    container: 'border border-slate-700/40 shadow-xl',
    imgWrapper: ''
  },
  'hellfire-pulse': {
    container: 'border-2 border-red-500/80 shadow-[0_0_22px_rgba(239,68,68,0.85)] animate-[pulse_2s_infinite]',
    imgWrapper: 'ring-2 ring-red-500/30 ring-offset-2 ring-offset-slate-950',
    extraElement:
    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-red-600 to-orange-500 opacity-30 blur-sm animate-pulse -z-10" />

  },
  'cyber-neon': {
    container: 'border-2 border-cyan-400 shadow-[0_0_22px_rgba(34,211,238,0.85)]',
    imgWrapper: 'ring-1 ring-cyan-400 ring-offset-1 ring-offset-slate-950',
    extraElement:
    <>
        <div className="absolute -inset-1.5 rounded-2xl border border-cyan-500/50 animate-ping opacity-25 -z-10" />
        <div className="absolute -inset-0.5 rounded-2xl bg-cyan-400/15 blur-[2px] -z-10" />
      </>

  },
  'cosmic-nebula': {
    container: 'border-2 border-purple-500/80 shadow-[0_0_25px_rgba(168,85,247,0.8)]',
    imgWrapper: 'ring-2 ring-fuchsia-500/30 ring-offset-2 ring-offset-slate-950',
    extraElement:
    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600 opacity-40 blur-[3px] animate-[pulse_3s_infinite] -z-10" />

  },
  'divine-gold': {
    container: 'border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.9)]',
    imgWrapper: 'ring-2 ring-yellow-400/40 ring-offset-2 ring-offset-slate-950',
    extraElement:
    <>
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-yellow-300 via-amber-400 to-yellow-600 opacity-35 blur-[2px] -z-10" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-300 rounded-full blur-[1px] animate-ping" />
      </>

  },
  'toxic-acid': {
    container: 'border-2 border-lime-400 shadow-[0_0_22px_rgba(132,204,22,0.85)] animate-[pulse_1.5s_infinite]',
    imgWrapper: 'ring-2 ring-lime-400/20 ring-offset-2 ring-offset-slate-950',
    extraElement:
    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-lime-500 to-emerald-500 opacity-30 blur-md -z-10" />

  },
  'vampiric-blood': {
    container: 'border-2 border-rose-600/90 shadow-[0_0_22px_rgba(225,29,72,0.9)]',
    imgWrapper: 'ring-2 ring-red-700/40 ring-offset-2 ring-offset-slate-950',
    extraElement:
    <div className="absolute -inset-1 rounded-2xl bg-rose-950 opacity-50 blur-[2px] animate-pulse -z-10" />

  },
  'rainbow-chroma': {
    container: 'border-2 border-transparent shadow-[0_0_25px_rgba(168,85,247,0.7)]',
    imgWrapper: '',
    extraElement:
    <>
        <div className="absolute -inset-[3px] rounded-2xl bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 opacity-75 blur-[2px] animate-[spin_5s_linear_infinite] -z-10" />
        <div className="absolute inset-0 rounded-2xl bg-slate-950 -z-10" />
      </>

  },
  'angelic-halo': {
    container: 'border border-amber-300/60 shadow-[0_0_15px_rgba(252,211,77,0.4)]',
    imgWrapper: '',
    extraElement:
    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-2 bg-gradient-to-r from-amber-300 to-yellow-200 rounded-full border border-yellow-400 opacity-80 shadow-[0_0_10px_rgba(251,191,36,0.8)] -rotate-[8deg] animate-bounce -z-10" style={{ transformOrigin: 'center' }} />

  },
  'shield-barrier': {
    container: 'border-2 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.6)]',
    imgWrapper: '',
    extraElement:
    <div className="absolute -inset-2 rounded-3xl border border-indigo-500/30 border-dashed animate-[spin_20s_linear_infinite] -z-10" />

  }
};

function RoomCard({
  roomData,
  onUpdateRoomSettings,
  onAddRoomItem,
  onRemoveRoomItem,
  onUpdateRoomItem,
  onAddEffect,
  onRemoveEffect,
  onToggleEffectActive,
  onUpdateEffectLevel,
  onAddArtifact,
  onRemoveArtifact,
  onUpdateArtifactLevel,
  onAddBooster,
  onRemoveBooster,
  onUpdateBoosterLevel,
  onUpdateBoosterType,
  onAddLog,
  webhookUrl,
  statsWebhookUrl,
  roomWebhookUrl,
  isExpandedView,
  onToggleExpand
}: any) {
  const [inputs, setInputs] = useState({
    effects: '',
    artifacts: '',
    boosters: '',
    structures: '',
    upgrades: '',
    items: '',
    effectText: '',
    effectLevel: '1',
    effectRarity: 'comum',
    artifactText: '',
    artifactLevel: '1',
    artifactRarity: 'comum',
    boosterText: '',
    boosterType: 'EXP',
    boosterLevel: '1',
    boosterRarity: 'epico'
  });

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [isEditingStats, setIsEditingStats] = useState(false);
  const [editedStatsText, setEditedStatsText] = useState(roomData.statsText || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const statsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditedStatsText(roomData.statsText || '');
  }, [roomData.statsText]);

  const customNameText = roomData.customName || roomData.name || 'PARADISE LOST';
  const nameFontFamily = DEATHS_FONTS[roomData.nameFont || 'sans'] || '"Inter", sans-serif';
  const nameGradientClasses = NAME_GRADIENTS[roomData.nameGradient || 'default'] || NAME_GRADIENTS['default'];

  const avatarGlowId = roomData.avatarGlow || 'none';
  const resolvedAvatarGlow = AVATAR_GLOWS[avatarGlowId] || AVATAR_GLOWS['none'];

  const syncRoomToDiscord = async () => {
    const targetWebhook = roomWebhookUrl || webhookUrl;
    if (!targetWebhook || targetWebhook.includes('...')) {
      alert('Webhook do Discord para a Sala Central ou Geral não configurado! Configure-o na barra lateral.');
      return;
    }
    if (!cardRef.current) return;

    setIsSyncing(true);

    // Guardar fontes de imagem originais
    const originalSrcs: {element: HTMLImageElement;originalSrc: string;}[] = [];
    const imgElements = Array.from(cardRef.current.querySelectorAll('img')) as HTMLImageElement[];
    imgElements.forEach((img) => {
      if (img.src && !img.src.startsWith('data:')) {
        originalSrcs.push({ element: img, originalSrc: img.src });
      }
    });

    const bgElements: {element: HTMLElement;originalBg: string;}[] = [];
    const allElements = Array.from(cardRef.current.querySelectorAll('*')) as HTMLElement[];
    for (const el of allElements) {
      if (el.style && el.style.backgroundImage && el.style.backgroundImage.includes('url(')) {
        bgElements.push({
          element: el,
          originalBg: el.style.backgroundImage
        });
      }
    }

    const originalDisplay = statsPanelRef.current ? statsPanelRef.current.style.display : null;

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));

      if (statsPanelRef.current) {
        statsPanelRef.current.style.display = 'none';
      }

      // Converte imagens do card para Base64
      await Promise.all(imgElements.map(async (img) => {
        const src = img.src || img.getAttribute('src');
        if (!src || src.startsWith('data:')) return;
        try {
          const b64 = await toDataURL(src, img);
          if (b64) {
            img.src = b64;
            await new Promise((resolve) => {
              if (img.complete) {
                resolve(true);
              } else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
              }
            });
          }
        } catch (e) {
          console.warn("Error converting image to base64 during sync:", src, e);
        }
      }));

      // Converte background-images para Base64
      await Promise.all(bgElements.map(async ({ element, originalBg }) => {
        const match = originalBg.match(/url\(['"]?(.*?)['"]?\)/);
        if (!match) return;
        const src = match[1];
        if (!src || src.startsWith('data:')) return;
        try {
          const b64 = await toDataURL(src);
          if (b64) {
            element.style.backgroundImage = `url("${b64}")`;
          }
        } catch (e) {
          console.warn("Error converting background-image to base64 during sync:", src, e);
        }
      }));

      await new Promise((resolve) => setTimeout(resolve, 300));

      let blob;
      try {
        blob = await toBlob(cardRef.current, {
          cacheBust: false,
          backgroundColor: '#0f172a',
          pixelRatio: 3.0,
          style: {
            background: '#0f172a',
            opacity: '1',
            transform: 'none'
          },
          filter: (node) => {
            if (node instanceof HTMLElement) {
              if (node.tagName === 'BUTTON' || node.classList.contains('no-export') || node.tagName === 'TEXTAREA') {
                return false;
              }
            }
            return true;
          }
        });
      } catch (firstErr) {
        console.warn("Failed to capture card with inlined images, retrying with fallback filter...", firstErr);
        blob = await toBlob(cardRef.current, {
          cacheBust: false,
          backgroundColor: '#0f172a',
          pixelRatio: 3.0,
          style: {
            background: '#0f172a',
            opacity: '1',
            transform: 'none'
          },
          filter: (node) => {
            if (node instanceof HTMLElement) {
              if (node.tagName === 'BUTTON' || node.classList.contains('no-export') || node.tagName === 'TEXTAREA') {
                return false;
              }
              if (node.tagName === 'IMG') {
                const src = node.getAttribute('src') || '';
                if (src.startsWith('data:')) {
                  return true;
                }
                const realHost = getRealHost();
                if (src.startsWith('http') && (!realHost || !src.includes(realHost))) {
                  return false;
                }
              }
            }
            return true;
          }
        });
      }

      if (!blob) throw new Error('Falha ao capturar imagem');

      const formData = new FormData();
      const filename = `sala-${(roomData.name || 'comando').toLowerCase().replace(/\s+/g, '-')}.png`;
      formData.append('file', blob, filename);

      const activeEffects = (roomData.effects || []).filter((e: any) => e.active !== false);
      const artifacts = roomData.artifacts || [];

      const fields: any[] = [
      {
        name: '👑 Nível / Status',
        value: roomData.customBadge || `Nível ${roomData.level || 100}`,
        inline: true
      },
      {
        name: 'EFEITOS',
        value: activeEffects.length > 0 ?
        activeEffects.map((e: any) => {
          const r = RARITY_LIST.find((rar) => rar.id === e.rarityId);
          const lvl = e.level ? ` [Lvl ${e.level}]` : '';
          return r && r.id !== 'comum' ? `[${r.name}] ${e.text}${lvl}` : `${e.text}${lvl}`;
        }).join('\n') :
        'Nenhum efeito ativo',
        inline: false
      },
      {
        name: '🏺 Artefatos da Sala',
        value: artifacts.length > 0 ?
        artifacts.map((a: any) => {
          const r = RARITY_LIST.find((rar) => rar.id === a.rarityId);
          const lvl = a.level ? ` [Lvl ${a.level}]` : '';
          return r && r.id !== 'comum' ? `[${r.name}] ${a.text}${lvl}` : `${a.text}${lvl}`;
        }).join('\n') :
        'Nenhum artefato registrado',
        inline: false
      }];


      const embed: any = {
        title: roomData.customEmbedTitle || `SALA: ${roomData.name || 'DE COMANDO'}`,
        description: roomData.customEmbedDescription || `Status e bônus ativos da Sala.`,
        color: roomData.customEmbedColor ? parseInt(roomData.customEmbedColor.replace('#', ''), 16) : 0x8b5cf6,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: 'Studio Painel • Central da Sala' }
      };

      if (roomData.customEmbedBanner) {
        embed.image = { url: getAbsoluteOriginalUrl(roomData.customEmbedBanner) };
      } else {
        embed.image = { url: `attachment://${filename}` };
      }

      const thumbUrl = roomData.customEmbedThumbnail || roomData.customAvatarUrl;
      if (thumbUrl) {
        embed.thumbnail = { url: getAbsoluteOriginalUrl(thumbUrl) };
      }

      formData.append('payload_json', JSON.stringify({
        content: '@everyone',
        username: `Central da Sala (${roomData.name || 'Comando'})`,
        avatar_url: getAbsoluteOriginalUrl(roomData.customAvatarUrl || ''),
        embeds: [embed]
      }));

      const res = await fetch(targetWebhook, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Error on Webhook');
      alert(`Status da Sala enviado para o Discord com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar dados da Sala para o Discord.');
    } finally {
      // Restaurar fontes de imagem e backgrounds
      originalSrcs.forEach(({ element, originalSrc }) => {
        if (element && originalSrc) {
          element.src = originalSrc;
        }
      });
      bgElements.forEach(({ element, originalBg }) => {
        if (element && originalBg) {
          element.style.backgroundImage = originalBg;
        }
      });
      if (statsPanelRef.current && originalDisplay !== null) {
        statsPanelRef.current.style.display = originalDisplay;
      }
      setIsSyncing(false);
    }
  };

  const syncStatsToDiscord = async () => {
    const targetWebhook = roomWebhookUrl || statsWebhookUrl || webhookUrl;
    if (!targetWebhook || targetWebhook.includes('...')) {
      alert('Webhook da Sala Central, de Estatísticas ou Geral não configurado!');
      return;
    }
    setIsSyncingStats(true);
    try {
      const parsed = parseStats(roomData.statsText || '');
      let markdownText = '';
      parsed.forEach((s: any) => {
        if (s.type === 'stat') {
          markdownText += `➳ **${s.label}**: \`${s.value}\`\n`;
        } else if (s.type === 'header') {
          markdownText += `\n**🏛️ ${s.text.toUpperCase()}**\n`;
        } else if (s.type === 'text') {
          markdownText += `*${s.text}*\n`;
        } else if (s.type === 'divider') {
          markdownText += `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`;
        }
      });

      const embed: any = {
        title: `Estatísticas RPG: ${roomData.name}`,
        description: markdownText || 'Sem estatísticas registradas.',
        color: roomData.customEmbedColor ? parseInt(roomData.customEmbedColor.replace('#', ''), 16) : 0x8b5cf6,
        timestamp: new Date().toISOString(),
        footer: { text: 'Studio Painel • Ficha da Sala' }
      };

      const formData = new FormData();
      if (statsPanelRef.current) {
        try {
          let blob = await toBlob(statsPanelRef.current, {
            cacheBust: false,
            backgroundColor: '#020617',
            pixelRatio: 2.5,
            style: {
              background: '#020617',
              padding: '16px',
              borderRadius: '16px',
              opacity: '1'
            },
            filter: (node) => {
              if (node instanceof HTMLElement) {
                if (node.tagName === 'BUTTON' || node.classList.contains('no-export') || node.tagName === 'TEXTAREA') {
                  return false;
                }
              }
              return true;
            }
          });
          if (blob) {
            const filename = `sala-${roomData.name.toLowerCase().replace(/\s+/g, '_')}.png`;
            formData.append('files[0]', blob, filename);
            embed.image = { url: `attachment://${filename}` };
          }
        } catch (imgErr) {
          console.error("Erro ao gerar imagem da Sala para o Discord:", imgErr);
        }
      }

      formData.append('payload_json', JSON.stringify({
        content: '@everyone',
        username: `${roomData.name} (Ficha da Sala)`,
        avatar_url: getAbsoluteOriginalUrl(roomData.customAvatarUrl || ''),
        embeds: [embed]
      }));

      const res = await fetch(targetWebhook, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Error on Webhook');
      alert(`Ficha da Sala enviada para o Discord com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar estatísticas da Sala.');
    } finally {
      setIsSyncingStats(false);
    }
  };

  const effectsCount = (roomData.effects || []).length;
  const activeEffectsCount = (roomData.effects || []).filter((e: any) => e.active !== false).length;
  const artifactsCount = (roomData.artifacts || []).length;

  return (
    <div className={`relative p-4 sm:p-6 ${isExpandedView ? 'md:col-span-12' : ''}`}>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bento-card border border-purple-500/30 bg-slate-950/90 shadow-2xl rounded-3xl relative overflow-hidden">
        
        {/* Background Image overlay if customBgUrl exists */}
        {roomData.customBgUrl &&
        <div
          style={{
            backgroundImage: `url(${getProxiedUrl(roomData.customBgUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
          className="absolute inset-0 w-full h-full opacity-20 pointer-events-none z-0" />

        }

        {/* Profile / Room Header */}
        <div className="flex items-center justify-between mb-8 relative z-10 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar / Emblem Frame */}
            <div className="relative shrink-0 select-none">
              {resolvedAvatarGlow.extraElement}
              <div className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-bold border border-purple-500/40 bg-purple-950/60 shadow-lg relative z-10 ${resolvedAvatarGlow.container}`}>
                <div className={`w-full h-full flex items-center justify-center ${resolvedAvatarGlow.imgWrapper} ${
                roomData.customAvatarUrl ? '' : 'bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-700'}`
                }>
                  {roomData.customAvatarUrl ?
                  <div
                    style={{
                      backgroundImage: `url(${getProxiedUrl(roomData.customAvatarUrl)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                    className="w-full h-full" /> :

                  roomData.customAvatarSymbol ?
                  <span className="text-2xl">{roomData.customAvatarSymbol}</span> :

                  <Castle size={26} className="text-purple-300" />
                  }
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className={`text-xl font-bold tracking-tight leading-none ${nameGradientClasses}`}
                  style={{ fontFamily: nameFontFamily }}>
                  
                  {customNameText}
                </h2>
                <span className="text-[9px] font-black uppercase tracking-widest text-purple-300 bg-purple-950/80 border border-purple-500/40 px-2 py-0.5 rounded-md shadow-[0_0_8px_rgba(168,85,247,0.3)]">
                  {roomData.customBadge || `DOMÍNIO DO CLÃ • NÍVEL ${roomData.level || 100}`}
                </span>
                <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  SALA ATIVA
                </span>
              </div>
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowCustomizer(!showCustomizer)}
              className="px-2.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-500/40 rounded-xl text-[10px] font-extrabold uppercase flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg hover:shadow-purple-500/20"
              title="Personalizar visual da Sala">
              
              <Sparkles size={12} className="text-purple-400" />
              <span>Customizar</span>
            </button>

            <button
              onClick={() => setShowStats(!showStats)}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-xl text-[10px] font-extrabold uppercase flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer">
              
              <Activity size={12} className="text-indigo-400" />
              <span>{showStats ? 'Ocultar Ficha' : 'Ficha da Sala'}</span>
            </button>

            <button
              onClick={syncRoomToDiscord}
              disabled={isSyncing}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-extrabold uppercase flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-indigo-500/20">
              
              {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              <span>Enviar Discord</span>
            </button>

            {onToggleExpand &&
            <button
              onClick={onToggleExpand}
              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 rounded-xl text-[10px] font-extrabold uppercase flex items-center gap-1 transition-all active:scale-95 cursor-pointer">
              
                {isExpandedView ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{isExpandedView ? 'Encolher' : 'Expandir'}</span>
              </button>
            }
          </div>
        </div>

        {/* Summary Chips Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-4 relative z-10">
          <div className="bg-slate-950/80 border border-purple-900/40 rounded-xl p-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-950 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles size={14} />
            </div>
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Efeitos</span>
              <span className="text-xs font-black text-purple-300 font-mono">
                {activeEffectsCount} / {effectsCount} Ativos
              </span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-amber-900/40 rounded-xl p-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-950 flex items-center justify-center text-amber-400 shrink-0">
              <Crown size={14} />
            </div>
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Artefatos</span>
              <span className="text-xs font-black text-amber-300 font-mono">
                {artifactsCount} Registrados
              </span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-emerald-900/40 rounded-xl p-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-950 flex items-center justify-center text-emerald-400 shrink-0">
              <Castle size={14} />
            </div>
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Domínio</span>
              <span className="text-xs font-black text-emerald-300 font-mono">
                Nível {roomData.level || 100} (MAX)
              </span>
            </div>
          </div>
        </div>

        {/* Customizer Drawer */}
        <AnimatePresence initial={false}>
          {showCustomizer &&
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border border-purple-500/20 bg-purple-950/15 rounded-2xl p-5 mb-6 space-y-3 no-export relative overflow-hidden backdrop-blur-sm shadow-xl z-20">
            
              <div className="flex items-center justify-between border-b border-purple-900/30 pb-1.5">
                <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1">
                  CUSTOMIZAÇÃO DA SALA DE COMANDO
                </span>
                <button
                onClick={() => setShowCustomizer(false)}
                className="text-slate-500 hover:text-white text-[9px] font-bold uppercase cursor-pointer">
                
                  Fechar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Nome da Sala */}
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Nome da Sala
                  </label>
                  <input
                  type="text"
                  value={roomData.customName || roomData.name || ''}
                  onChange={(e) => onUpdateRoomSettings({ customName: e.target.value, name: e.target.value })}
                  placeholder="Ex: PARADISE LOST"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                
                </div>

                {/* 2. Cargo / Título */}
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Título / Badge
                  </label>
                  <input
                  type="text"
                  value={roomData.customBadge || ''}
                  onChange={(e) => onUpdateRoomSettings({ customBadge: e.target.value })}
                  placeholder="Ex: NÍVEL MAX • DOMÍNIO ATIVO"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                
                </div>

                {/* 3. Ícone / Símbolo */}
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Símbolo / Emoji da Sala
                  </label>
                  <input
                  type="text"
                  value={roomData.customAvatarSymbol || ''}
                  onChange={(e) => onUpdateRoomSettings({ customAvatarSymbol: e.target.value })}
                  placeholder="Ex: ⚔️, 👑, 🏰"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                
                </div>

                {/* URL da Imagem do Avatar */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    URL da Imagem / Emblema da Sala (Avatar)
                  </label>
                  <input
                  type="text"
                  value={roomData.customAvatarUrl || ''}
                  onChange={(e) => onUpdateRoomSettings({ customAvatarUrl: e.target.value })}
                  placeholder="https://i.imgur.com/..."
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                
                </div>

                {/* Decoração da Foto de Perfil / Avatar */}
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Iluminação / Decoração da Foto de Perfil
                  </label>
                  <select
                  value={roomData.avatarGlow || 'none'}
                  onChange={(e) => onUpdateRoomSettings({ avatarGlow: e.target.value })}
                  className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                  
                    <option value="none" className="bg-slate-950 text-slate-400">Padrão (Sem Decoração)</option>
                    <option value="hellfire-pulse" className="bg-slate-950 text-red-400 font-bold">🔥 Pulso de Fogo (Hellfire)</option>
                    <option value="cyber-neon" className="bg-slate-950 text-cyan-400 font-bold">⚡ Neon Gelo (Cyber)</option>
                    <option value="cosmic-nebula" className="bg-slate-950 text-purple-400 font-bold">🌌 Nebulosa Cósmica (Roxo)</option>
                    <option value="divine-gold" className="bg-slate-950 text-yellow-400 font-bold">✨ Ouro Divino (Brilho)</option>
                    <option value="toxic-acid" className="bg-slate-950 text-lime-400 font-bold">☣️ Ácido Tóxico (Verde)</option>
                    <option value="vampiric-blood" className="bg-slate-950 text-rose-500 font-bold">🩸 Sangue Vampírico</option>
                    <option value="rainbow-chroma" className="bg-slate-950 text-indigo-400 font-extrabold">🌈 RGB Arco-Íris Giratório</option>
                    <option value="angelic-halo" className="bg-slate-950 text-amber-300 font-bold">👼 Halo Angelical Celestial</option>
                    <option value="shield-barrier" className="bg-slate-950 text-indigo-400 font-bold">🛡️ Barreira de Escudo Girável</option>
                  </select>
                </div>

                {/* Fonte do Nome da Sala */}
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Fonte do Nome
                  </label>
                  <select
                  value={roomData.nameFont || 'sans'}
                  onChange={(e) => onUpdateRoomSettings({ nameFont: e.target.value })}
                  className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                  
                    <option value="sans">Inter (Padrão)</option>
                    <option value="mono">JetBrains Mono</option>
                    <option value="orbitron">Orbitron (Tech)</option>
                    <option value="marker">Marker (Escrito)</option>
                    <option value="cinzel">Cinzel (Épico)</option>
                    <option value="playfair">Playfair (Elegante)</option>
                    <option value="outfit">Outfit (Moderno)</option>
                    <option value="creepster">Creepster (Horror)</option>
                    <option value="retro">Press Start (Pixel)</option>
                  </select>
                </div>

                {/* Gradiente do Nome da Sala */}
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Gradiente do Nome
                  </label>
                  <select
                  value={roomData.nameGradient || 'default'}
                  onChange={(e) => onUpdateRoomSettings({ nameGradient: e.target.value })}
                  className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                  
                    <option value="default">Branco (Padrão)</option>
                    <option value="sunset-fire">Sunset Fire (Laranja/Vermelho)</option>
                    <option value="nebula-aurora">Nebula Aurora (Fúcsia/Roxo/Ciano)</option>
                    <option value="acid-green">Acid Green (Lima/Verde)</option>
                    <option value="royal-gold">Royal Gold (Ouro Nobre)</option>
                    <option value="electric-cyan">Electric Cyan (Ciano Elétrico)</option>
                    <option value="vampire-gaze">Vampire Gaze (Vampiro Sangue)</option>
                    <option value="chrome-metallic">Chrome Metallic (Prata Metálico)</option>
                  </select>
                </div>

                {/* URL da Imagem de Fundo */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    URL da Imagem de Fundo (Plano de Fundo do Card)
                  </label>
                  <input
                  type="text"
                  value={roomData.customBgUrl || ''}
                  onChange={(e) => onUpdateRoomSettings({ customBgUrl: e.target.value })}
                  placeholder="https://i.imgur.com/..."
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                
                </div>

                {/* EMBED DISCORD CUSTOMIZATION SECTION */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 border-t border-purple-900/30 pt-3 mt-1">
                  <span className="text-[9px] font-extrabold text-purple-400 uppercase tracking-wider block mb-2">
                    🤖 EMBED DO DISCORD (PERSONALIZADO)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Título do Embed
                      </label>
                      <input
                      type="text"
                      value={roomData.customEmbedTitle || ''}
                      onChange={(e) => onUpdateRoomSettings({ customEmbedTitle: e.target.value })}
                      placeholder={`SALA: ${roomData.name || 'DE COMANDO'}`}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                    
                    </div>

                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Descrição do Embed
                      </label>
                      <input
                      type="text"
                      value={roomData.customEmbedDescription || ''}
                      onChange={(e) => onUpdateRoomSettings({ customEmbedDescription: e.target.value })}
                      placeholder="Status e bônus ativos da Sala."
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                    
                    </div>

                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Cor do Embed (HEX)
                      </label>
                      <input
                      type="text"
                      value={roomData.customEmbedColor || ''}
                      onChange={(e) => onUpdateRoomSettings({ customEmbedColor: e.target.value })}
                      placeholder="#8b5cf6"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                    
                    </div>

                    <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        URL da Imagem Banner do Embed (Banner do Discord)
                      </label>
                      <input
                      type="text"
                      value={roomData.customEmbedBanner || ''}
                      onChange={(e) => onUpdateRoomSettings({ customEmbedBanner: e.target.value })}
                      placeholder="https://i.imgur.com/... (Envia imagem grande no Discord)"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                    
                    </div>

                    <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        URL da Thumbnail Pequena do Embed
                      </label>
                      <input
                      type="text"
                      value={roomData.customEmbedThumbnail || ''}
                      onChange={(e) => onUpdateRoomSettings({ customEmbedThumbnail: e.target.value })}
                      placeholder="https://i.imgur.com/... (Se vazio, usa a imagem do Avatar)"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                    
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {/* Section Grid Structure (Matching MemberCard) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 relative z-10">
          {/* Efeitos */}
          <Section
            title="EFEITOS"
            items={roomData.effects || []}
            value={inputs.effects}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, effects: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => {
              if (typeof onAddRoomItem === 'function') {
                onAddRoomItem('effects', inputs.effects, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament);
              } else if (typeof onAddEffect === 'function') {
                onAddEffect(inputs.effects, rarityId || 'comum', level || '1');
              }
              setInputs((prev) => ({ ...prev, effects: '' }));
            }}
            onRemove={(id: string) => {
              if (typeof onRemoveRoomItem === 'function') {
                onRemoveRoomItem('effects', id);
              } else if (typeof onRemoveEffect === 'function') {
                onRemoveEffect(id);
              }
            }}
            onUpdate={(id: string, data: any) => {
              if (typeof onUpdateRoomItem === 'function') {
                onUpdateRoomItem('effects', id, data);
              }
            }}
            clearInput={() => setInputs((prev) => ({ ...prev, effects: '' }))}
            isSyncing={isSyncing}
            showLevel={true} />
          

          {/* Artefatos */}
          <Section
            title="Artefatos da Sala"
            items={roomData.artifacts || []}
            value={inputs.artifacts}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, artifacts: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => {
              if (typeof onAddRoomItem === 'function') {
                onAddRoomItem('artifacts', inputs.artifacts, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament);
              } else if (typeof onAddArtifact === 'function') {
                onAddArtifact(inputs.artifacts, rarityId || 'comum', level || '1');
              }
              setInputs((prev) => ({ ...prev, artifacts: '' }));
            }}
            onRemove={(id: string) => {
              if (typeof onRemoveRoomItem === 'function') {
                onRemoveRoomItem('artifacts', id);
              } else if (typeof onRemoveArtifact === 'function') {
                onRemoveArtifact(id);
              }
            }}
            onUpdate={(id: string, data: any) => {
              if (typeof onUpdateRoomItem === 'function') {
                onUpdateRoomItem('artifacts', id, data);
              }
            }}
            clearInput={() => setInputs((prev) => ({ ...prev, artifacts: '' }))}
            isSyncing={isSyncing}
            showLevel={true} />
          
        </div>

        {/* Room RPG Statistics Panel */}
        <div id="rpg-stats-panel" ref={statsPanelRef} className="border border-purple-500/20 rounded-2xl p-4 bg-slate-900/40 relative overflow-hidden backdrop-blur-sm shadow-xl mt-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
              Estatísticas Atuais
              <button
                onClick={() => setShowCustomizer(!showCustomizer)}
                className="opacity-20 hover:opacity-100 focus:opacity-100 text-slate-500 hover:text-purple-400 ml-1.5 p-0.5 rounded transition-all cursor-pointer no-export"
                title="Personalizar Card da Sala (Secreto)">
                
                <Sparkles size={11} className="animate-pulse" />
              </button>
            </span>
            <div className="flex gap-2 no-export">
              {roomData.statsText &&
              <button
                onClick={syncStatsToDiscord}
                disabled={isSyncingStats}
                className="text-[9px] font-bold px-2.5 py-1 bg-purple-900/30 hover:bg-purple-600 border border-purple-500/20 hover:border-purple-400 rounded-lg text-purple-300 hover:text-white transition-all uppercase flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                title="Enviar Estatísticas para o Canal de RPG">
                
                  {isSyncingStats ?
                <Loader2 size={10} className="animate-spin text-purple-300" /> :

                <Send size={10} className="text-purple-300" />
                }
                  {isSyncingStats ? 'Enviando...' : 'Enviar Status'}
                </button>
              }
              <button
                onClick={() => {
                  setIsEditingStats(!isEditingStats);
                  if (!showStats) setShowStats(true);
                }}
                className="text-[9px] font-bold px-2 py-1 bg-slate-800 border border-slate-700/50 hover:border-purple-500/40 rounded-lg text-slate-300 transition-all uppercase cursor-pointer">
                
                {isEditingStats ? 'Ver Status' : 'Editar'}
              </button>
              <button
                onClick={() => setShowStats(!showStats)}
                className="text-[9px] font-bold px-2 py-1 bg-slate-800 border border-slate-700/50 hover:border-purple-500/40 rounded-lg text-slate-300 transition-all uppercase cursor-pointer">
                
                {showStats ? 'Recolher' : 'Expandir'}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showStats &&
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden">
              
                {isEditingStats && !isSyncing && !isSyncingStats ?
              <div className="space-y-3 pt-2">
                    <textarea
                  value={editedStatsText}
                  onChange={(e) => setEditedStatsText(e.target.value)}
                  className="w-full h-72 bg-slate-950 border border-slate-800/80 rounded-xl p-3 font-mono text-[11px] text-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500/50 leading-relaxed"
                  placeholder="Cole as estatísticas formatadas da Sala aqui..." />
                
                    <div className="flex gap-2 justify-end">
                      <button
                    onClick={() => {
                      onUpdateRoomSettings({ statsText: editedStatsText });
                      setIsEditingStats(false);
                      if (typeof onAddLog === 'function') {
                        onAddLog('SYSTEM', 'Ficha da Sala de Comando atualizada!', 'success');
                      }
                    }}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer">
                    
                        Salvar Alterações
                      </button>
                      <button
                    onClick={() => {
                      setEditedStatsText(roomData.statsText || '');
                      setIsEditingStats(false);
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer">
                    
                        Cancelar
                      </button>
                    </div>
                  </div> :

              <div className="pt-2">
                    {roomData.statsText ?
                <div
                    className={`grid gap-2 ${
                    isSyncing || isSyncingStats ? '' : 'grid-cols-2' : 'grid-cols-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar'}`
                    }
                    style={isSyncing || isSyncingStats ? { maxHeight: 'none', overflow: 'visible' } : undefined}>
                        {parseStats(roomData.statsText).map((item: any, idx: number) => {
                    if (item.type === 'empty') return null;
                    if (item.type === 'divider') {
                      return <div key={idx} className="border-t border-slate-800/60 my-2 col-span-2" />;
                    }
                    if (item.type === 'header') {
                      return (
                        <div key={idx} className="col-span-2 mt-2 mb-1">
                                <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5 bg-purple-950/20 px-2 py-1 rounded-md border border-purple-950/30">
                                  👑 {item.text}
                                </h4>
                              </div>);

                    }
                    if (item.type === 'text') {
                      return (
                        <div key={idx} className="col-span-2 text-[10px] text-slate-400 italic bg-slate-950/30 p-1.5 rounded border border-slate-900 font-mono">
                                {item.text}
                              </div>);

                    }

                    const valStr = item.value || '';
                    const labelStr = item.label || '';
                    const isMax = valStr.toLowerCase().includes('max') || valStr.toLowerCase().includes('1e+100');
                    const isNone = valStr.toLowerCase() === 'none' || valStr === '0' || valStr === '0%';
                    const isThreat = labelStr.toLowerCase().includes('ameaça');
                    const isTemperature = labelStr.trim().toLowerCase() === 'temperatura';

                    let cardStyles = 'border-slate-800/80 hover:border-purple-500/40';
                    let labelStyles = 'text-slate-500';
                    let valueStyles = 'text-purple-300 group-hover/stat:text-white';

                    const selectedThreatStyle = THREAT_STYLES[roomData.threatColor || 'default'] || THREAT_STYLES['default'];
                    let selectedTemperatureStyle = null;

                    if (isTemperature) {
                      const match = item.value.match(/-?\d+(\.\d+)?/);
                      const tempNum = match ? parseFloat(match[0]) : null;
                      if (tempNum !== null) {
                        if (tempNum < 15) {
                          selectedTemperatureStyle = MAIN_STAT_STYLES['frost-ice'];
                        } else if (tempNum > 30) {
                          selectedTemperatureStyle = MAIN_STAT_STYLES['magma-orange'];
                        }
                      }
                    }

                    if (isThreat) {
                      cardStyles = selectedThreatStyle.card;
                      labelStyles = selectedThreatStyle.label;
                      valueStyles = selectedThreatStyle.value;
                    } else if (isTemperature && selectedTemperatureStyle) {
                      cardStyles = selectedTemperatureStyle.card;
                      labelStyles = selectedTemperatureStyle.label;
                      valueStyles = selectedTemperatureStyle.value;
                    } else if (isMax) {
                      cardStyles = 'border-amber-500/30 bg-amber-500/[0.02] hover:border-amber-500/50';
                      labelStyles = 'text-slate-500';
                      valueStyles = 'text-amber-300 font-bold';
                    } else if (isNone) {
                      cardStyles = 'border-slate-800/40 bg-slate-950/40 opacity-60';
                      labelStyles = 'text-slate-600';
                      valueStyles = 'text-slate-500';
                    }

                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl border flex flex-col justify-between transition-all duration-200 group/stat relative ${cardStyles}`}>
                        
                              {isThreat && selectedThreatStyle.thumbnail &&
                        <img
                          src={selectedThreatStyle.thumbnail.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(selectedThreatStyle.thumbnail)}` : selectedThreatStyle.thumbnail}
                          className="w-7 h-7 object-contain absolute right-2 top-2 rounded"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous" />

                        }
                              {isThreat && !selectedThreatStyle.thumbnail &&
                        <span className={`w-1.5 h-1.5 rounded-full absolute right-2 top-2 ${selectedThreatStyle.ping}`}></span>
                        }
                              <span className={`text-[8px] font-bold uppercase tracking-wider block ${labelStyles}`}>
                                {item.label}
                              </span>
                              <span className={`text-[11px] font-mono font-bold mt-0.5 block truncate ${valueStyles}`}>
                                {item.value}
                              </span>
                            </div>);

                  })}
                      </div> :

                <div className="text-center py-6 text-slate-500 text-[10px] italic border border-dashed border-slate-800 rounded-xl">
                        Nenhuma estatística cadastrada para a Sala de Comando.
                      </div>
                }
                  </div>
              }
              </motion.div>
            }
          </AnimatePresence>
        </div>
      </motion.div>
    </div>);

}

function GlobalExportModal({
  isOpen,
  onClose,
  members,
  selectedMemberName,
  onSelectMember,
  statsWebhookUrl,
  webhookUrl








}: {isOpen: boolean;onClose: () => void;members: any[];selectedMemberName: string;onSelectMember: (name: string) => void;statsWebhookUrl: string;webhookUrl: string;}) {
  const [statsScale, setStatsScale] = useState<number>(2.5);
  const [exportFormat, setExportFormat] = useState<'pc' | 'mobile'>('pc');
  const [onlyRelevantStats, setOnlyRelevantStats] = useState<boolean>(true);
  const [previewStatsUrl, setPreviewStatsUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState<boolean>(false);
  const [isExportingStatsImage, setIsExportingStatsImage] = useState<boolean>(false);
  const [isSyncingStats, setIsSyncingStats] = useState<boolean>(false);

  const [showDiscordSettings, setShowDiscordSettings] = useState<boolean>(true);
  const [webhookName, setWebhookName] = useState<string>('');
  const [webhookContent, setWebhookContent] = useState<string>('');
  const [embedTitle, setEmbedTitle] = useState<string>('');
  const [embedColor, setEmbedColor] = useState<string>('#4f46e5');
  const [embedDescription, setEmbedDescription] = useState<string>('Estatísticas atuais no painel do Studio.');
  const [embedFooter, setEmbedFooter] = useState<string>('');

  const modalStatsPanelRef = useRef<HTMLDivElement>(null);

  const currentMember = members.find((m) => m.name === selectedMemberName) || members[0];

  useEffect(() => {
    if (currentMember) {
      const savedWebhookName = localStorage.getItem(`studio_discord_webhook_name_${currentMember.name}`);
      setWebhookName(savedWebhookName !== null ? savedWebhookName : `Central RPG - ${currentMember.name}`);

      const savedWebhookContent = localStorage.getItem(`studio_discord_webhook_content_global`) || localStorage.getItem(`studio_discord_webhook_content_${currentMember.name}`);
      setWebhookContent(savedWebhookContent !== null ? savedWebhookContent : '');

      const savedEmbedTitle = localStorage.getItem(`studio_discord_embed_title_${currentMember.name}`);
      setEmbedTitle(savedEmbedTitle !== null ? savedEmbedTitle : `📊 Estatísticas do Personagem - ${currentMember.name}`);

      const savedEmbedColor = localStorage.getItem(`studio_discord_embed_color_${currentMember.name}`);
      setEmbedColor(savedEmbedColor !== null ? savedEmbedColor : currentMember.customSettings?.embedColor || '#6366f1');

      const savedEmbedDescription = localStorage.getItem(`studio_discord_embed_description_${currentMember.name}`);
      setEmbedDescription(savedEmbedDescription !== null ? savedEmbedDescription : `Estatísticas atuais no painel do Studio.`);

      const savedEmbedFooter = localStorage.getItem(`studio_discord_embed_footer_${currentMember.name}`);
      setEmbedFooter(savedEmbedFooter !== null ? savedEmbedFooter : `Status • Modo: ${onlyRelevantStats ? 'Relevantes' : 'Todos'} • Layout: ${exportFormat.toUpperCase()} • Res: ${statsScale}x`);
    }
  }, [selectedMemberName, currentMember?.name, onlyRelevantStats, exportFormat, statsScale]);

  const generateModalImageBlob = async (scale = statsScale, format = exportFormat) => {
    if (!modalStatsPanelRef.current) return null;
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      let blob = await toBlob(modalStatsPanelRef.current, {
        cacheBust: false,
        backgroundColor: '#020617',
        pixelRatio: scale,
        style: {
          background: '#020617',
          padding: '16px',
          borderRadius: '16px',
          opacity: '1',
          maxHeight: 'none',
          overflow: 'visible',
          height: 'auto'
        },
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.tagName === 'BUTTON' || node.classList.contains('no-export') || node.tagName === 'TEXTAREA') {
              return false;
            }
          }
          return true;
        }
      });
      return blob;
    } catch (err) {
      console.error("Erro ao gerar imagem das estatísticas:", err);
      return null;
    }
  };

  const updatePreviewImage = async () => {
    if (!isOpen || !currentMember) return;
    setIsGeneratingPreview(true);
    try {
      let blob = await generateModalImageBlob(statsScale, exportFormat);
      if (blob) {
        if (previewStatsUrl) URL.revokeObjectURL(previewStatsUrl);
        const url = URL.createObjectURL(blob);
        setPreviewStatsUrl(url);
      }
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentMember) {
      updatePreviewImage();
    }
  }, [isOpen, selectedMemberName, exportFormat, statsScale, onlyRelevantStats]);

  const handleDownloadStatsImage = async () => {
    setIsExportingStatsImage(true);
    try {
      let blob = await generateModalImageBlob(statsScale, exportFormat);
      if (blob && currentMember) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Estatisticas_${currentMember.name.replace(/\s+/g, '_')}_${exportFormat}_${statsScale}x.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Erro ao baixar imagem:", err);
      alert("Erro ao extrair imagem das estatísticas.");
    } finally {
      setIsExportingStatsImage(false);
    }
  };

  const handleCopyStatsImage = async () => {
    setIsExportingStatsImage(true);
    try {
      let blob = await generateModalImageBlob(statsScale, exportFormat);
      if (blob && currentMember && navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([new (window as any).ClipboardItem({ 'image/png': blob })]);
        alert(`Imagem das estatísticas de ${currentMember.name} copiada para a área de transferência!`);
      } else {
        alert("Cópia direta para a área de transferência não suportada neste navegador.");
      }
    } catch (err) {
      console.error("Erro ao copiar imagem:", err);
      alert("Erro ao copiar imagem.");
    } finally {
      setIsExportingStatsImage(false);
    }
  };

  const syncStatsToDiscord = async () => {
    if (!currentMember) return;
    const activeWebhook = statsWebhookUrl || webhookUrl;
    if (!activeWebhook) {
      alert("Por favor, configure o Webhook do Discord nas configurações do painel!");
      return;
    }

    setIsSyncingStats(true);
    try {
      const embedHex = embedColor.startsWith('#') ? parseInt(embedColor.replace('#', ''), 16) : 0x4f46e5;

      const embed: any = {
        title: embedTitle || `📊 Estatísticas do Personagem - ${currentMember.name}`,
        description: embedDescription || undefined,
        color: isNaN(embedHex) ? 0x4f46e5 : embedHex,
        timestamp: new Date().toISOString(),
        footer: { text: embedFooter || `Status • Modo: ${onlyRelevantStats ? 'Relevantes' : 'Todos'}` }
      };

      const formData = new FormData();
      let blob = await generateModalImageBlob(statsScale, exportFormat);

      if (blob) {
        const filename = `stats-${currentMember.name.toLowerCase().replace(/\s+/g, '_')}_${exportFormat}.png`;
        formData.append('files[0]', blob, filename);
        embed.image = { url: `attachment://${filename}` };
      }

      const payload: any = {
        username: webhookName || `Central RPG - ${currentMember.name}`,
        content: webhookContent || undefined,
        avatar_url: currentMember.customAvatarUrl || currentMember.customSettings?.bannerUrl || undefined,
        embeds: [embed]
      };

      formData.append('payload_json', JSON.stringify(payload));

      const res = await fetch(activeWebhook, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        alert(`Estatísticas e imagem de ${currentMember.name} enviadas ao Discord com sucesso!`);
      } else {
        alert("Erro ao enviar ao Discord. Verifique a URL do Webhook.");
      }
    } catch (err) {
      console.error("Erro ao sincronizar estatísticas:", err);
      alert("Falha na conexão com o Discord Webhook.");
    } finally {
      setIsSyncingStats(false);
    }
  };

  if (!isOpen || !currentMember) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 no-export">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full p-5 shadow-2xl relative flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Camera size={18} className="text-cyan-400" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  Pré-Imagem & Exportação de Estatísticas
                </h3>
                <p className="text-[10px] text-slate-400">Gere imagens em alta definição e personalize o Embed/Webhook do Discord</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer">
              
              <X size={16} />
            </button>
          </div>

          {/* Seleção do Membro */}
          <div className="flex flex-col gap-1.5 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={12} className="text-indigo-400" /> Selecionar Personagem / Membro:
            </label>
            <div className="flex gap-2 flex-wrap">
              {members.map((m) =>
              <button
                key={m.name}
                onClick={() => onSelectMember(m.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                currentMember.name === m.name ?
                'bg-indigo-600 text-white shadow-md font-extrabold border border-indigo-400/50' :
                'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'}`
                }>
                
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.customSettings?.embedColor || '#6366f1' }} />
                  {m.name}
                </button>
              )}
            </div>
          </div>

          {/* Opções de Imagem (Formato, Resolução, Filtro) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-[11px]">
            
            {/* Formato Dispositivo */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Monitor size={12} className="text-cyan-400" /> Formato / Layout
              </span>
              <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setExportFormat('pc')}
                  className={`py-1.5 px-2 rounded-md font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  exportFormat === 'pc' ? 'bg-indigo-600 text-white shadow-sm font-extrabold' : 'text-slate-400 hover:text-slate-200'}`
                  }>
                  
                  <Monitor size={11} /> 💻 PC (2 Cols)
                </button>
                <button
                  onClick={() => setExportFormat('mobile')}
                  className={`py-1.5 px-2 rounded-md font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  exportFormat === 'mobile' ? 'bg-indigo-600 text-white shadow-sm font-extrabold' : 'text-slate-400 hover:text-slate-200'}`
                  }>
                  
                  <Smartphone size={11} /> 📱 Celular (1 Col)
                </button>
              </div>
            </div>

            {/* Resolução */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-purple-400" /> Resolução
              </span>
              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setStatsScale(1.5)}
                  className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                  statsScale === 1.5 ?
                  'bg-purple-600 text-white shadow-sm font-extrabold' :
                  'text-slate-400 hover:text-slate-200'}`
                  }>
                  
                  1.5x HD
                </button>
                <button
                  onClick={() => setStatsScale(2.5)}
                  className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                  statsScale === 2.5 ?
                  'bg-purple-600 text-white shadow-sm font-extrabold' :
                  'text-slate-400 hover:text-slate-200'}`
                  }>
                  
                  2.5x HD
                </button>
                <button
                  onClick={() => setStatsScale(4.0)}
                  className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                  statsScale === 4.0 ?
                  'bg-purple-600 text-white shadow-sm font-extrabold' :
                  'text-slate-400 hover:text-slate-200'}`
                  }>
                  
                  4x Ultra
                </button>
              </div>
            </div>

            {/* Filtro de Stats */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sliders size={12} className="text-emerald-400" /> Conteúdo
              </span>
              <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setOnlyRelevantStats(true)}
                  className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                  onlyRelevantStats ?
                  'bg-emerald-600 text-white shadow-sm font-extrabold' :
                  'text-slate-400 hover:text-slate-200'}`
                  }>
                  
                  🎯 Relevantes
                </button>
                <button
                  onClick={() => setOnlyRelevantStats(false)}
                  className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                  !onlyRelevantStats ?
                  'bg-emerald-600 text-white shadow-sm font-extrabold' :
                  'text-slate-400 hover:text-slate-200'}`
                  }>
                  
                  🌐 Todos
                </button>
              </div>
            </div>

          </div>

          {/* Configurações Personalizadas de Webhook e Embed Discord */}
          <div className="bg-slate-950/90 rounded-xl border border-indigo-900/50 p-3.5 flex flex-col gap-3">
            <button
              onClick={() => setShowDiscordSettings(!showDiscordSettings)}
              className="flex items-center justify-between text-xs font-bold text-indigo-300 hover:text-indigo-200 w-full cursor-pointer select-none">
              
              <span className="flex items-center gap-2 uppercase tracking-wider text-[11px]">
                <Send size={13} className="text-indigo-400" /> ⚙️ Personalizar Mensagem & Embed do Discord
                <span className="text-[9px] font-normal text-emerald-400 lowercase italic ml-1 block sm:inline bg-emerald-950/40 border border-emerald-900/40 px-1.5 py-0.5 rounded">(salva automaticamente)</span>
              </span>
              <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                {showDiscordSettings ? '▼ Ocultar' : '▲ Configurar'}
              </span>
            </button>

            {showDiscordSettings &&
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80 text-xs">
                
                {/* Nome do Webhook (Bot) */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    🤖 Nome do Webhook / Bot:
                  </label>
                  <input
                  type="text"
                  value={webhookName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWebhookName(val);
                    if (currentMember) {
                      localStorage.setItem(`studio_discord_webhook_name_${currentMember.name}`, val);
                    }
                  }}
                  placeholder="Ex: Central RPG - Asta"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs" />
                
                </div>

                {/* Texto Acima (Mensagem do Webhook) */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    💬 Texto Acima da Imagem (Mensagem):
                  </label>
                  <input
                  type="text"
                  value={webhookContent}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWebhookContent(val);
                    if (currentMember) {
                      localStorage.setItem(`studio_discord_webhook_content_global`, val);
                      localStorage.setItem(`studio_discord_webhook_content_${currentMember.name}`, val);
                    }
                  }}
                  placeholder="Ex: @here Ficha e Estatísticas atualizadas!"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs" />
                
                </div>

                {/* Título do Embed */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    📌 Título do Embed:
                  </label>
                  <input
                  type="text"
                  value={embedTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmbedTitle(val);
                    if (currentMember) {
                      localStorage.setItem(`studio_discord_embed_title_${currentMember.name}`, val);
                    }
                  }}
                  placeholder="Ex: 📊 Estatísticas do Personagem"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs" />
                
                </div>

                {/* Cor do Embed */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    🎨 Cor do Embed:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                    type="color"
                    value={embedColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmbedColor(val);
                      if (currentMember) {
                        localStorage.setItem(`studio_discord_embed_color_${currentMember.name}`, val);
                      }
                    }}
                    className="w-8 h-8 rounded cursor-pointer bg-slate-900 border border-slate-800 p-0.5 shrink-0" />
                  
                    <input
                    type="text"
                    value={embedColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmbedColor(val);
                      if (currentMember) {
                        localStorage.setItem(`studio_discord_embed_color_${currentMember.name}`, val);
                      }
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs w-full uppercase" />
                  
                  </div>
                </div>

                {/* Descrição do Embed */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    📝 Descrição do Embed (Texto Principal):
                  </label>
                  <textarea
                  rows={2}
                  value={embedDescription}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmbedDescription(val);
                    if (currentMember) {
                      localStorage.setItem(`studio_discord_embed_description_${currentMember.name}`, val);
                    }
                  }}
                  placeholder="Ex: Estatísticas oficiais do personagem atualizadas no painel do Studio."
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs resize-none" />
                
                </div>

                {/* Texto do Rodapé */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    🔻 Texto Abaixo (Rodapé / Footer):
                  </label>
                  <input
                  type="text"
                  value={embedFooter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmbedFooter(val);
                    if (currentMember) {
                      localStorage.setItem(`studio_discord_embed_footer_${currentMember.name}`, val);
                    }
                  }}
                  placeholder="Ex: Status • Central RPG • Hoje às 16:00"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs" />
                
                </div>

              </div>
            }
          </div>

          {/* Hidden Canvas Element Captured for Export */}
          <div className="absolute left-[-9999px] top-[-9999px] pointer-events-none opacity-0">
            <div
              ref={modalStatsPanelRef}
              className="p-5 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 w-[580px]"
              style={{ background: '#020617' }}>
              
              <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentMember.customSettings?.embedColor || '#6366f1' }} />
                  <h3 className="font-extrabold text-base text-white uppercase tracking-wider">{currentMember.name}</h3>
                </div>
                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">STATISTICS SHEET</span>
              </div>

              {currentMember.statsText ?
              <div className={`grid gap-2 text-[11px] ${exportFormat === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {(() => {
                  const ALWAYS_SHOW_KEYWORDS = [
                  'potencia', 'potência', 'resistencia', 'resistência', 'recistencia', 'recistência',
                  'ki', 'tipo de ip', 'nivel', 'nível', 'level', 'parte do ip', 'funções', 'funcoes', 'sistema', 'ameaça', 'ameaca', 'temperatura',
                  'exp', 'kills', 'gang', 'shiks', 'bankai', 'estilo atual', 'habilidade habilidosa', 'bugcrowd', 'bug crowd', 'núcleo', 'nucleo', 'classe'];


                  const parsedAll = parseStats(currentMember.statsText);
                  const statsList = parsedAll.filter((item: any) => {
                    if (!onlyRelevantStats) return true;
                    if (item.type === 'header' || item.type === 'text') return true;
                    if (item.type === 'empty' || item.type === 'divider') return false;
                    if (item.type === 'stat') {
                      const labelStr = item.label || '';
                      const valStr = item.value || '';
                      const labelLower = labelStr.toLowerCase().trim();
                      const isCore = ALWAYS_SHOW_KEYWORDS.some((k) => labelLower === k || labelLower.includes(k));
                      if (isCore) return true;

                      const valLower = valStr.toLowerCase().trim();
                      const isUnsetVal = [
                      'none', 'none.', '0', '0%', 'bloqueado', 'bloqueado.',
                      'canonic', 'canonic.', 'knonic', 'knonic.', '𝐧𝐨𝐧𝐞', 'nenhum', '❌'].
                      includes(valLower);
                      return !isUnsetVal;
                    }
                    return true;
                  });

                  const isSingleCol = exportFormat === 'mobile';

                  return statsList.map((item: any, idx: number) => {
                    if (item.type === 'empty') return null;
                    if (item.type === 'divider') {
                      return <div key={idx} className={`border-t border-slate-800/60 my-2 ${isSingleCol ? 'col-span-1' : 'col-span-2'}`} />;
                    }
                    if (item.type === 'header') {
                      return (
                        <div key={idx} className={`mt-2 mb-1 ${isSingleCol ? 'col-span-1' : 'col-span-2'}`}>
                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 bg-indigo-950/20 px-2 py-1 rounded-md border border-indigo-950/30">
                              {item.text}
                            </h4>
                          </div>);

                    }
                    if (item.type === 'text') {
                      return (
                        <div key={idx} className={`text-[10px] text-slate-400 italic bg-slate-950/30 p-1.5 rounded border border-slate-900 font-mono ${isSingleCol ? 'col-span-1' : 'col-span-2'}`}>
                            {item.text}
                          </div>);

                    }

                    // Type stat: glowy visual cards matching MemberCard
                    const valStr = item.value || '';
                    const labelStr = item.label || '';
                    const isMax = valStr.toLowerCase().includes('max') || valStr.toLowerCase().includes('1e+100');
                    const isNone = valStr.toLowerCase() === 'none' || valStr === ' canonic ' || valStr === 'Canonic' || valStr === '𝐍𝐨𝐧𝐞' || valStr === '0' || valStr === '0%';
                    const isThreat = labelStr.toLowerCase().includes('ameaça');
                    const isKi = labelStr.trim().toLowerCase() === 'ki';
                    const isIpPart = labelStr.trim().toLowerCase() === 'parte do ip' || labelStr.trim().toLowerCase() === 'parte de ip';
                    const isTemperature = labelStr.trim().toLowerCase() === 'temperatura';

                    let cardStyles = 'border-slate-800/80 bg-slate-950/50';
                    let labelStyles = 'text-slate-500';
                    let valueStyles = 'text-indigo-300';

                    const threatColorVal = currentMember.threatColor || 'default';
                    const mainStatsColorVal = currentMember.mainStatsColor || 'default';
                    const kiCardColorVal = currentMember.kiCardColor || 'default';
                    const ipPartCardColorVal = currentMember.ipPartCardColor || 'default';
                    const temperatureCardColorVal = currentMember.temperatureCardColor || 'default';

                    const selectedThreatStyle = THREAT_STYLES[threatColorVal] || THREAT_STYLES['default'];
                    const selectedMainStatsStyle = MAIN_STAT_STYLES[mainStatsColorVal] || MAIN_STAT_STYLES['default'];
                    const selectedKiStyle = MAIN_STAT_STYLES[kiCardColorVal] || MAIN_STAT_STYLES['default'];
                    const selectedIpPartStyle = MAIN_STAT_STYLES[ipPartCardColorVal] || MAIN_STAT_STYLES['default'];

                    let selectedTemperatureStyle = MAIN_STAT_STYLES[temperatureCardColorVal] || MAIN_STAT_STYLES['default'];

                    if (isTemperature && temperatureCardColorVal === 'default') {
                      // Auto detect based on threshold
                      const match = item.value.match(/-?\d+(\.\d+)?/);
                      const tempNum = match ? parseFloat(match[0]) : null;
                      if (tempNum !== null) {
                        if (tempNum < 15) {
                          selectedTemperatureStyle = MAIN_STAT_STYLES['frost-ice'];
                        } else if (tempNum > 30) {
                          selectedTemperatureStyle = MAIN_STAT_STYLES['magma-orange'];
                        }
                      }
                    }

                    if (isThreat) {
                      cardStyles = selectedThreatStyle.card;
                      labelStyles = selectedThreatStyle.label;
                      valueStyles = selectedThreatStyle.value;
                    } else if (isKi) {
                      cardStyles = selectedKiStyle.card;
                      labelStyles = selectedKiStyle.label;
                      valueStyles = selectedKiStyle.value;
                    } else if (isIpPart) {
                      cardStyles = selectedIpPartStyle.card;
                      labelStyles = selectedIpPartStyle.label;
                      valueStyles = selectedIpPartStyle.value;
                    } else if (isTemperature) {
                      cardStyles = selectedTemperatureStyle.card;
                      labelStyles = selectedTemperatureStyle.label;
                      valueStyles = selectedTemperatureStyle.value;
                    } else if (isMax) {
                      cardStyles = 'border-amber-500/30 bg-amber-500/[0.02]';
                      labelStyles = 'text-slate-500';
                      valueStyles = 'text-amber-400 font-extrabold';
                    } else if (isNone) {
                      cardStyles = 'border-slate-800/40 opacity-70';
                      labelStyles = 'text-slate-500';
                      valueStyles = 'text-slate-400';
                    } else {
                      cardStyles = selectedMainStatsStyle.card;
                      labelStyles = selectedMainStatsStyle.label;
                      valueStyles = selectedMainStatsStyle.value;
                    }

                    return (
                      <div
                        key={idx}
                        className={`border rounded-xl p-2.5 flex flex-col justify-between shadow-inner relative ${cardStyles}`}>
                        
                          {isThreat && selectedThreatStyle.thumbnail &&
                        <img
                          src={selectedThreatStyle.thumbnail.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(selectedThreatStyle.thumbnail)}` : selectedThreatStyle.thumbnail}
                          className="w-7 h-7 object-contain absolute right-2 top-2 rounded"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous" />

                        }
                          {isThreat && !selectedThreatStyle.thumbnail &&
                        <span className={`w-1.5 h-1.5 rounded-full absolute right-2 top-2 ${selectedThreatStyle.ping}`}></span>
                        }
                          <span className={`text-[9px] font-extrabold uppercase tracking-widest truncate ${labelStyles}`}>
                            {item.label}
                          </span>
                          <span className={`text-[12px] font-mono font-bold tracking-tight mt-0.5 truncate ${valueStyles}`}>
                            {item.value}
                          </span>
                        </div>);

                  });
                })()}
                </div> :

              <div className="text-slate-500 text-xs italic py-4 text-center">
                  Nenhuma estatística cadastrada.
                </div>
              }
            </div>
          </div>

          {/* Pré Imagem Preview Area */}
          <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800/80 flex flex-col items-center justify-center relative min-h-[200px] overflow-hidden">
            {isGeneratingPreview ?
            <div className="flex flex-col items-center gap-2 text-cyan-400 py-12">
                <Loader2 size={26} className="animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider">Gerando Pré-Imagem HD ({exportFormat === 'mobile' ? '📱 Celular' : '💻 PC'}, {statsScale}x)...</span>
              </div> :
            previewStatsUrl ?
            <img
              src={previewStatsUrl}
              alt={`Pré-imagem Estatísticas ${currentMember.name}`}
              className="max-w-full max-h-[50vh] h-auto rounded-lg shadow-2xl object-contain border border-slate-800" /> :


            <span className="text-slate-500 text-xs">Nenhuma pré-imagem gerada.</span>
            }
          </div>

          {/* Botões de Ação Final */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 flex-wrap gap-2">
            <span className="text-[10px] text-slate-500 italic">
              ✨ Imagem renderizada inteira sem barras de rolagem.
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleDownloadStatsImage}
                disabled={isExportingStatsImage}
                className="px-3.5 py-2 bg-emerald-950/70 border border-emerald-500/40 hover:bg-emerald-900/80 rounded-xl text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50">
                
                {isExportingStatsImage ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                Baixar PNG ({statsScale}x)
              </button>
              <button
                onClick={handleCopyStatsImage}
                disabled={isExportingStatsImage}
                className="px-3.5 py-2 bg-purple-950/70 border border-purple-500/40 hover:bg-purple-900/80 rounded-xl text-purple-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50">
                
                <Copy size={13} />
                Copiar Imagem
              </button>
              <button
                onClick={syncStatsToDiscord}
                disabled={isSyncingStats}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95 disabled:opacity-50">
                
                {isSyncingStats ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {isSyncingStats ? 'Enviando...' : 'Enviar pro Discord'}
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>);

}

function MemberCard({
  member,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onAddPunishment,
  onRemovePunishment,
  onUpdateStatsText,
  onUpdateCustomSettings,
  onRemoveMember,
  onAddLog,
  webhookUrl,
  statsWebhookUrl,
  onOpenExportModal
}: any) {
  const [inputs, setInputs] = useState({ functions: '', chars: '', elements: '', artifacts: '', races: '', ingredients: '', forms: '', items: '', punishment: '' });
  const [punishmentType, setPunishmentType] = useState<'warning' | 'expulsion'>('warning');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const statsPanelRef = useRef<HTMLDivElement>(null);

  const [showStats, setShowStats] = useState(member.name === 'Nkleozin' || member.name === 'Afogz' || member.name === 'Asta' || !!member.statsText);
  const [isEditingStats, setIsEditingStats] = useState(false);
  const [editedStatsText, setEditedStatsText] = useState(member.statsText || '');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [deathsMultiplier, setDeathsMultiplier] = useState<number>(1);
  const [onlyRelevantStats, setOnlyRelevantStats] = useState(true);
  const [isExportingStatsImage, setIsExportingStatsImage] = useState(false);
  const [statsScale, setStatsScale] = useState<number>(2.5);
  const [exportFormat, setExportFormat] = useState<'pc' | 'mobile'>('pc');
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewStatsUrl, setPreviewStatsUrl] = useState<string | null>(null);
  const [showBountyPicker, setShowBountyPicker] = useState(false);
  const [bountyInput, setBountyInput] = useState(String(member.bounty || 0));

  useEffect(() => {
    setBountyInput(String(member.bounty || 0));
  }, [member.bounty]);

  const handleSaveBounty = () => {
    const value = parseInt(bountyInput) || 0;
    onUpdateCustomSettings(member.name, { bounty: value });
    setShowBountyPicker(false);
  };
  const [isGeneratingPreview, setIsGeneratingPreview] = useState<boolean>(false);
  const [isCapturingForImage, setIsCapturingForImage] = useState<boolean>(false);

  const generateStatsImageBlob = async (scale = statsScale, format = exportFormat) => {
    if (!statsPanelRef.current) return null;
    setIsCapturingForImage(true);
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      let blob = await toBlob(statsPanelRef.current, {
        cacheBust: false,
        backgroundColor: '#020617',
        pixelRatio: scale,
        style: {
          background: '#020617',
          padding: '16px',
          borderRadius: '16px',
          opacity: '1',
          maxHeight: 'none',
          overflow: 'visible',
          height: 'auto'
        },
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.tagName === 'BUTTON' || node.classList.contains('no-export') || node.tagName === 'TEXTAREA') {
              return false;
            }
          }
          return true;
        }
      });
      return blob;
    } catch (err) {
      console.error("Erro ao gerar imagem das estatísticas:", err);
      return null;
    } finally {
      setIsCapturingForImage(false);
    }
  };

  const updatePreviewImage = async (scale = statsScale, format = exportFormat) => {
    setIsGeneratingPreview(true);
    try {
      let blob = await generateStatsImageBlob(scale, format);
      if (blob) {
        if (previewStatsUrl) URL.revokeObjectURL(previewStatsUrl);
        const url = URL.createObjectURL(blob);
        setPreviewStatsUrl(url);
      }
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  useEffect(() => {
    if (showPreviewModal) {
      updatePreviewImage(statsScale, exportFormat);
    }
  }, [showPreviewModal, exportFormat, statsScale, onlyRelevantStats]);

  const handleDownloadStatsImage = async () => {
    setIsExportingStatsImage(true);
    try {
      let blob = await generateStatsImageBlob(statsScale, exportFormat);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Estatisticas_${member.name.replace(/\s+/g, '_')}_${exportFormat}_${statsScale}x.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Erro ao baixar imagem das estatísticas:", err);
      alert("Erro ao extrair imagem das estatísticas.");
    } finally {
      setIsExportingStatsImage(false);
    }
  };

  const handleCopyStatsImage = async () => {
    setIsExportingStatsImage(true);
    try {
      let blob = await generateStatsImageBlob(statsScale, exportFormat);
      if (blob && navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([new (window as any).ClipboardItem({ 'image/png': blob })]);
        alert(`Imagem das estatísticas de ${member.name} copiada para a área de transferência!`);
      } else {
        alert("Seu navegador não suporta copiar imagens diretamente.");
      }
    } catch (err) {
      console.error("Erro ao copiar imagem das estatísticas:", err);
      alert("Erro ao copiar imagem das estatísticas.");
    } finally {
      setIsExportingStatsImage(false);
    }
  };

  const updateResetsStateAndText = (m: any, newResets: number) => {
    onUpdateCustomSettings(m.name, { resets: newResets });
    let currentStats = m.statsText || '';
    if (currentStats) {
      if (currentStats.match(/([➳\s]*Resets\s*=\s*)(\d+)/i)) {
        currentStats = currentStats.replace(/([➳\s]*Resets\s*=\s*)(\d+)/i, `$1${newResets}`);
      } else if (currentStats.match(/([➳\s]*Resets\s*:\s*)(\d+)/i)) {
        currentStats = currentStats.replace(/([➳\s]*Resets\s*:\s*)(\d+)/i, `$1${newResets}`);
      } else {
        if (currentStats.includes('Kills')) {
          currentStats = currentStats.replace(/([^\n]*Kills[^\n]*)/i, `$1\n➳ Resets = ${newResets}`);
        } else {
          currentStats += `\n➳ Resets = ${newResets}`;
        }
      }
      onUpdateStatsText(m.name, currentStats);
    }
  };

  const updateTrueResetsStateAndText = (m: any, newTrueResets: number) => {
    onUpdateCustomSettings(m.name, { trueResets: newTrueResets });
    let currentStats = m.statsText || '';
    if (currentStats) {
      const displayVal = newTrueResets ? '✅' : '❌';
      if (currentStats.match(/([➳\s]*True\s*Reset\s*=\s*)([^\n]*)/i)) {
        currentStats = currentStats.replace(/([➳\s]*True\s*Reset\s*=\s*)([^\n]*)/i, `$1${displayVal}`);
      } else if (currentStats.match(/([➳\s]*𝗧𝗿𝘂𝗲\s*𝗥𝗲𝘀𝗲𝘁\s*=\s*)([^\n]*)/iu)) {
        currentStats = currentStats.replace(/([➳\s]*𝗧𝗿𝘂𝗲\s*𝗥𝗲𝘀𝗲𝘁\s*=\s*)([^\n]*)/iu, `$1${displayVal}`);
      } else {
        currentStats += `\n➳ True Reset = ${displayVal}`;
      }
      onUpdateStatsText(m.name, currentStats);
    }
  };

  const handleReset = (m: any) => {
    let currentStats = m.statsText || '';
    if (!currentStats) return;

    // 1. Increment Resets by 1
    const resetsMatch = currentStats.match(/([➳\s]*Resets\s*=\s*)(\d+)/i) || currentStats.match(/([➳\s]*Resets\s*:\s*)(\d+)/i);
    let newResets = (m.resets || 0) + 1;
    if (resetsMatch) {
      newResets = parseInt(resetsMatch[2]) + 1;
      currentStats = currentStats.replace(/([➳\s]*Resets\s*=\s*)(\d+)/i, `$1${newResets}`);
      currentStats = currentStats.replace(/([➳\s]*Resets\s*:\s*)(\d+)/i, `$1${newResets}`);
    } else {
      if (currentStats.includes('Kills')) {
        currentStats = currentStats.replace(/([^\n]*Kills[^\n]*)/i, `$1\n➳ Resets = ${newResets}`);
      } else {
        currentStats += `\n➳ Resets = ${newResets}`;
      }
    }

    // 2. Reset Level / Nivel / level to 0
    currentStats = currentStats.replace(/(Nivel\s*=\s*)([^\n]*)/i, '$10');
    currentStats = currentStats.replace(/(level\s*:\s*)([^\n]*)/i, '$10');

    // 3. Reset Exp to 0
    currentStats = currentStats.replace(/(Exp\s*=\s*)([^\n]*)/i, '$10');

    // 4. Set O Usuario pode resetar? = ❌
    currentStats = currentStats.replace(/(O Usuario pode resetar\?\s*=\s*)([^\n]*)/i, '$1❌');

    // Update state
    onUpdateCustomSettings(m.name, { resets: newResets });
    onUpdateStatsText(m.name, currentStats);

    // Add log
    if (typeof onAddLog === 'function') {
      onAddLog('SYSTEM', `✨ ${m.name} realizou um Reset! (Total: ${newResets})`, 'info');
    }
    alert(`${m.name} resetado com sucesso! Resets: ${newResets}. Nível e Exp foram resetados para 0.`);
  };

  const handleTrueReset = (m: any) => {
    const confirmTrue = window.confirm(`Tem certeza que deseja realizar um True Reset em ${m.name}? Isso apagará todo o progresso (inclusive resets e mortes) e definirá o True Reset como Ativo (✅)!`);
    if (!confirmTrue) return;

    let currentStats = m.statsText || '';
    if (!currentStats) return;

    // 1. Reset Resets to 0
    currentStats = currentStats.replace(/(Resets\s*=\s*)([^\n]*)/i, '$10');
    currentStats = currentStats.replace(/(Resets\s*:\s*)([^\n]*)/i, '$10');

    // 2. Reset Level / Nivel to 0
    currentStats = currentStats.replace(/(Nivel\s*=\s*)([^\n]*)/i, '$10');
    currentStats = currentStats.replace(/(level\s*:\s*)([^\n]*)/i, '$10');

    // 3. Reset Exp to 0
    currentStats = currentStats.replace(/(Exp\s*=\s*)([^\n]*)/i, '$10');

    // 4. Reset Kills to 0
    currentStats = currentStats.replace(/(Kills\s*=\s*)([^\n]*)/i, '$10');

    const newTrueResets = 1; // Active

    // 5. Set True Reset to ✅
    currentStats = currentStats.replace(/(𝗧𝗿𝘂𝗲\s*𝗥𝗲𝘀𝗲𝘁\s*=\s*)([^\n]*)/iu, '$1✅');
    currentStats = currentStats.replace(/(True\s*Reset\s*=\s*)([^\n]*)/i, '$1✅');

    // 6. Set Mortes to Nenhum in statsText
    currentStats = currentStats.replace(/(Mortes\s*=\s*)([^\n]*)/i, '$1Nenhum');

    // Update statsText and custom settings
    onUpdateStatsText(m.name, currentStats);
    onUpdateCustomSettings(m.name, { resets: 0, trueResets: newTrueResets, deaths: 0 });

    if (typeof onAddLog === 'function') {
      onAddLog('SYSTEM', `💀💀 TRUE RESET executado por ${m.name}! Todo o progresso foi limpo e o True Reset foi ativado.`, 'error');
    }
    alert(`True Reset concluído com sucesso para ${m.name}! Todos os resets, mortes, níveis, exp e kills foram limpos e o True Reset está ativo.`);
  };

  // Resolved customizable deaths styles
  const deathsLabelText = member.deathsLabel || 'MORTES';
  const deathsIconId = member.deathsIcon || 'skull';
  const deathsFontId = member.deathsFont || 'sans';
  const deathsGradientId = member.deathsGradient || 'crimson-hellfire';
  const deathsButtonsStyle = member.deathsButtonsStyle || 'hover';

  const SelectedDeathsIcon = DEATHS_ICONS[deathsIconId] || Skull;
  const deathsFontStyleFamily = DEATHS_FONTS[deathsFontId] || '"Inter", sans-serif';
  const deathsGradientStyle = DEATHS_GRADIENTS[deathsGradientId] || DEATHS_GRADIENTS['crimson-hellfire'];

  // Resolved customizable name styles
  const customNameText = member.customName || member.name;
  const nameFontFamily = DEATHS_FONTS[member.nameFont || 'sans'] || '"Inter", sans-serif';
  const nameGradientClasses = NAME_GRADIENTS[member.nameGradient || 'default'] || NAME_GRADIENTS['default'];

  // Resolved customizable avatar styles
  const avatarGlowId = member.avatarGlow || 'none';
  const resolvedAvatarGlow = AVATAR_GLOWS[avatarGlowId] || AVATAR_GLOWS['none'];

  useEffect(() => {
    if (member.statsText !== undefined) {
      setEditedStatsText(member.statsText);
    }
  }, [member.statsText]);

  const syncToDiscord = async () => {
    if (!webhookUrl || webhookUrl.includes('...')) {
      alert('Webhook do Discord não configurado! Clique no ícone de configurações na barra lateral.');
      return;
    }

    if (!cardRef.current) return;

    setIsSyncing(true);

    // Guardar referências de todas as imagens do card para inlining e restauração
    const imgElements = Array.from(cardRef.current.querySelectorAll('img')) as HTMLImageElement[];
    const originalSrcs = imgElements.map((img) => ({
      element: img,
      originalSrc: img.src || img.getAttribute('src') || ''
    }));

    // Guardar referências de todos os background-images para inlining e restauração
    const bgElements: {element: HTMLElement;originalBg: string;}[] = [];
    const allDescendants = cardRef.current.getElementsByTagName('*');
    for (let i = 0; i < allDescendants.length; i++) {
      const el = allDescendants[i] as HTMLElement;
      if (el.style && el.style.backgroundImage && el.style.backgroundImage.includes('url(')) {
        bgElements.push({
          element: el,
          originalBg: el.style.backgroundImage
        });
      }
    }

    const originalDisplay = statsPanelRef.current ? statsPanelRef.current.style.display : null;

    try {
      // Pequeno atraso para garantir que o React renderize e remova as barras de rolagem antes do print
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Oculta temporariamente o painel de estatísticas para não ser capturado no card principal
      if (statsPanelRef.current) {
        statsPanelRef.current.style.display = 'none';
      }

      // Converte todas as imagens do card para Base64 antes da captura para evitar problemas de CORS e SVG rendering
      await Promise.all(imgElements.map(async (img) => {
        const src = img.src || img.getAttribute('src');
        if (!src || src.startsWith('data:')) return;
        try {
          // Passamos a própria img para podermos tentar a renderização via canvas direta primeiro se já estiver carregada!
          const b64 = await toDataURL(src, img);
          if (b64) {
            img.src = b64;
            // Aguarda o decodificador do navegador reconhecer e aplicar a nova fonte de imagem base64
            await new Promise((resolve) => {
              if (img.complete) {
                resolve(true);
              } else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
              }
            });
          }
        } catch (e) {
          console.warn("Error converting image to base64 during sync:", src, e);
        }
      }));

      // Converte todos os background-images para Base64 também!
      await Promise.all(bgElements.map(async ({ element, originalBg }) => {
        const match = originalBg.match(/url\(['"]?(.*?)['"]?\)/);
        if (!match) return;
        const src = match[1];
        if (!src || src.startsWith('data:')) return;
        try {
          const b64 = await toDataURL(src);
          if (b64) {
            element.style.backgroundImage = `url("${b64}")`;
          }
        } catch (e) {
          console.warn("Error converting background-image to base64 during sync:", src, e);
        }
      }));

      // Atraso de folga adicional de 300ms para garantir que todas as imagens estão renderizadas perfeitamente no DOM
      await new Promise((resolve) => setTimeout(resolve, 300));

      let blob;
      try {
        blob = await toBlob(cardRef.current, {
          cacheBust: false,
          backgroundColor: '#0f172a',
          pixelRatio: 3.0,
          style: {
            background: '#0f172a',
            opacity: '1',
            transform: 'none'
          },
          filter: (node) => {
            if (node instanceof HTMLElement) {
              if (node.tagName === 'BUTTON' || node.classList.contains('no-export') || node.tagName === 'TEXTAREA') {
                return false;
              }
            }
            return true;
          }
        });
      } catch (firstErr) {
        console.warn("Failed to capture card with inlined images, retrying with fallback filter...", firstErr);
        blob = await toBlob(cardRef.current, {
          cacheBust: false,
          backgroundColor: '#0f172a',
          pixelRatio: 3.0,
          style: {
            background: '#0f172a',
            opacity: '1',
            transform: 'none'
          },
          filter: (node) => {
            if (node instanceof HTMLElement) {
              if (node.tagName === 'BUTTON' || node.classList.contains('no-export') || node.tagName === 'TEXTAREA') {
                return false;
              }
              if (node.tagName === 'IMG') {
                const src = node.getAttribute('src') || '';
                if (src.startsWith('data:')) {
                  return true;
                }
                const realHost = getRealHost();
                if (src.startsWith('http') && (!realHost || !src.includes(realHost))) {
                  return false;
                }
              }
            }
            return true;
          }
        });
      }

      if (!blob) throw new Error('Falha ao capturar imagem');

      const formData = new FormData();
      formData.append('file', blob, `status-${member.name.toLowerCase()}.png`);

      const embed: any = {
        title: `Relatório: ${member.name}`,
        description: `Status atualizado de **${member.name}** extraído do Studio Painel.`,
        color: getEmbedColorInteger(member),
        fields: [
        { name: 'Funções', value: member.functions.length > 0 ? member.functions.map((f: any) => {
            const r = RARITY_LIST.find((rar) => rar.id === f.rarityId);
            const lvl = f.level ? ` [Lvl ${f.level === '3' || f.level === 'MAX' ? 'MAX' : f.level}]` : '';
            return r && r.id !== 'comum' ? `[${r.name}] ${f.text}${lvl}` : `${f.text}${lvl}`;
          }).join(', ') : 'N/A', inline: true },
        { name: 'Chars', value: member.chars.length > 0 ? member.chars.map((c: any) => {
            const r = RARITY_LIST.find((rar) => rar.id === c.rarityId);
            const lvl = c.level ? ` [Lvl ${c.level === '3' || c.level === 'MAX' ? 'MAX' : c.level}]` : '';
            return r && r.id !== 'comum' ? `[${r.name}] ${c.text}${lvl}` : `${c.text}${lvl}`;
          }).join(', ') : 'N/A', inline: true },
        { name: 'Elementos', value: member.elements.length > 0 ? member.elements.map((e: any) => {
            const r = RARITY_LIST.find((rar) => rar.id === e.rarityId);
            const lvl = e.level ? ` [Lvl ${e.level === '3' || e.level === 'MAX' ? 'MAX' : e.level}]` : '';
            return r && r.id !== 'comum' ? `[${r.name}] ${e.text}${lvl}` : `${e.text}${lvl}`;
          }).join(', ') : 'N/A', inline: true },
        { name: 'Artefatos', value: (member.artifacts || []).length > 0 ? (member.artifacts || []).map((a: any) => {
            const r = RARITY_LIST.find((rar) => rar.id === a.rarityId);
            const lvl = a.level ? ` [Lvl ${a.level === '3' || a.level === 'MAX' ? 'MAX' : a.level}]` : '';
            return r && r.id !== 'comum' ? `[${r.name}] ${a.text}${lvl}` : `${a.text}${lvl}`;
          }).join(', ') : 'N/A', inline: true },
        { name: 'Raças', value: (member.races || []).length > 0 ? (member.races || []).map((ra: any) => {
            const r = RARITY_LIST.find((rar) => rar.id === ra.rarityId);
            const lvl = ra.level ? ` [Lvl ${ra.level === '4' || ra.level === 'MAX' ? 'MAX' : ra.level}]` : '';
            return r && r.id !== 'comum' ? `[${r.name}] ${ra.text}${lvl}` : `${ra.text}${lvl}`;
          }).join(', ') : 'N/A', inline: true },
        { name: 'Ingredientes', value: (member.ingredients || []).length > 0 ? (member.ingredients || []).map((i: any) => {
            const r = RARITY_LIST.find((rar) => rar.id === i.rarityId);
            const q = i.quantity ? ` (${i.quantity})` : '';
            const lvl = i.level ? ` [Lvl ${i.level === '3' || i.level === 'MAX' ? 'MAX' : i.level}]` : '';
            return r && r.id !== 'comum' ? `[${r.name}] ${i.text}${lvl}${q}` : `${i.text}${lvl}${q}`;
          }).join(', ') : 'N/A', inline: true },
        { name: 'Formas', value: (member.forms || []).length > 0 ? (member.forms || []).map((fo: any) => {
            const r = RARITY_LIST.find((rar) => rar.id === fo.rarityId);
            const lvl = fo.level ? ` [Lvl ${fo.level === '3' || fo.level === 'MAX' ? 'MAX' : fo.level}]` : '';
            return r && r.id !== 'comum' ? `[${r.name}] ${fo.text}${lvl}` : `${fo.text}${lvl}`;
          }).join(', ') : 'N/A', inline: true },
        { name: 'Itens', value: (member.items || []).length > 0 ? (member.items || []).map((it: any) => {
            const r = RARITY_LIST.find((rar) => rar.id === it.rarityId);
            const lvl = it.level ? ` [Lvl ${it.level === '3' || it.level === 'MAX' ? 'MAX' : it.level}]` : '';
            return r && r.id !== 'comum' ? `[${r.name}] ${it.text}${lvl}` : `${it.text}${lvl}`;
          }).join(', ') : 'N/A', inline: true },
        { name: 'Bounty', value: `$ ${(member.bounty || 0).toLocaleString('pt-BR')}`, inline: true },
        { name: '☠️ Mortes', value: String(member.deaths !== undefined ? member.deaths : 0), inline: true }],

        timestamp: new Date().toISOString(),
        footer: { text: 'Status' }
      };

      embed.image = { url: `attachment://status-${member.name.toLowerCase()}.png` };

      if (member.customEmbedThumbnail) {
        if (member.customEmbedThumbnail.trim().toLowerCase() !== 'null') {
          embed.thumbnail = { url: getAbsoluteOriginalUrl(member.customEmbedThumbnail) };
        }
      } else if (member.customAvatarUrl) {
        if (member.customAvatarUrl.trim().toLowerCase() !== 'null') {
          embed.thumbnail = { url: getAbsoluteOriginalUrl(member.customAvatarUrl) };
        }
      }

      formData.append('payload_json', JSON.stringify({
        username: `${member.name} (Status)`,
        avatar_url: getAbsoluteOriginalUrl(member.customAvatarUrl || member.customEmbedThumbnail || ''),
        embeds: [embed]
      }));

      const res = await fetch(webhookUrl, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Webhook error');
      alert(`Status de ${member.name} enviado para o Discord com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar para o Discord. Verifique a URL do Webhook.');
    } finally {
      // Restaurar os srcs originais de todas as imagens
      originalSrcs.forEach(({ element, originalSrc }) => {
        if (element && originalSrc) {
          element.src = originalSrc;
        }
      });
      // Restaurar os background-images originais
      bgElements.forEach(({ element, originalBg }) => {
        if (element && originalBg) {
          element.style.backgroundImage = originalBg;
        }
      });
      // Restaura a visibilidade do painel de estatísticas
      if (statsPanelRef.current && originalDisplay !== null) {
        statsPanelRef.current.style.display = originalDisplay;
      }
      setIsSyncing(false);
    }
  };

  const syncStatsToDiscord = async () => {
    const targetWebhook = statsWebhookUrl || webhookUrl;
    if (!targetWebhook || targetWebhook.includes('...')) {
      alert('Webhook do Discord para Estatísticas não configurado! Configure-o na barra lateral.');
      return;
    }

    setIsSyncingStats(true);
    try {
      const embedColor = getEmbedColorInteger(member);

      const embed: any = {
        title: member.name.toUpperCase(),
        description: `Estatísticas atuais no painel do Studio.`,
        color: embedColor,
        timestamp: new Date().toISOString(),
        footer: { text: `Status • Modo: ${onlyRelevantStats ? 'Relevantes' : 'Todos'} • Layout: ${exportFormat.toUpperCase()} • Res: ${statsScale}x` }
      };

      if (member.statsText) {
        const ALWAYS_SHOW_KEYWORDS = [
        'potencia', 'potência', 'resistencia', 'resistência', 'recistencia', 'recistência',
        'ki', 'tipo de ip', 'nivel', 'nível', 'level', 'parte do ip', 'funções', 'funcoes', 'sistema', 'ameaça', 'ameaca', 'temperatura',
        'exp', 'kills', 'gang', 'shiks', 'bankai', 'estilo atual', 'habilidade habilidosa', 'bugcrowd', 'bug crowd', 'núcleo', 'nucleo', 'classe'];


        const parsedAll = parseStats(member.statsText);
        const parsed = parsedAll.filter((s: any) => {
          if (!onlyRelevantStats) return true;
          if (s.type === 'header' || s.type === 'text') return true;
          if (s.type === 'divider') return false;
          if (s.type === 'stat') {
            const labelStr = s.label || '';
            const valStr = s.value || '';
            const labelLower = labelStr.toLowerCase().trim();
            const isCore = ALWAYS_SHOW_KEYWORDS.some((k) => labelLower === k || labelLower.includes(k));
            if (isCore) return true;

            const valLower = valStr.toLowerCase().trim();
            const isUnsetVal = [
            'none', 'none.', '0', '0%', 'bloqueado', 'bloqueado.',
            'canonic', 'canonic.', 'knonic', 'knonic.', '𝐧𝐨𝐧𝐞', 'nenhum', '❌'].
            includes(valLower);
            return !isUnsetVal;
          }
          return true;
        });

        let markdownText = '';
        parsed.forEach((s: any) => {
          if (s.type === 'stat') {
            const valStr = s.value || '';
            const labelStr = s.label || '';
            const isMax = valStr.toLowerCase().includes('max') || valStr.toLowerCase().includes('1e+100');
            const isNone = valStr.toLowerCase() === 'none' || valStr === ' canonic ' || valStr === 'Canonic' || valStr === '𝐍𝐨𝐧𝐞' || valStr === '0' || valStr === '0%';
            const isThreat = labelStr.toLowerCase().includes('ameaça');

            if (isThreat) {
              const cleanValue = s.value.replace('🌌', '').trim();
              const isCosmic = s.value.toLowerCase().includes('cósmic') || cleanValue.toLowerCase().includes('cósmic');
              markdownText += `⚠️ **${s.label}**: \`${cleanValue}\`${isCosmic ? ' 🌌' : ''}\n`;
            } else if (isMax) {
              markdownText += `➳ **${s.label}**: \`${s.value}\`\n`;
            } else if (isNone) {
              markdownText += `➳ **${s.label}**: \`${s.value}\`\n`;
            } else {
              markdownText += `➳ **${s.label}**: \`${s.value}\`\n`;
            }
          } else if (s.type === 'header') {
            markdownText += `\n**👑 ${s.text.toUpperCase()}**\n`;
          } else if (s.type === 'text') {
            markdownText += `*${s.text}*\n`;
          } else if (s.type === 'divider') {
            markdownText += `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`;
          }
        });

        if (markdownText.length > 2000) {
          markdownText = markdownText.substring(0, 1997) + '...';
        }
        embed.description = markdownText;
      }

      if (member.customEmbedBanner) {
        if (member.customEmbedBanner.trim().toLowerCase() === 'null') {
          embed.image = undefined;
        } else {
          embed.image = { url: getAbsoluteOriginalUrl(member.customEmbedBanner) };
        }
      }

      if (member.customEmbedThumbnail) {
        if (member.customEmbedThumbnail.trim().toLowerCase() === 'null') {
          embed.thumbnail = undefined;
        } else {
          embed.thumbnail = { url: getAbsoluteOriginalUrl(member.customEmbedThumbnail) };
        }
      } else if (member.customAvatarUrl) {
        if (member.customAvatarUrl.trim().toLowerCase() === 'null') {
          embed.thumbnail = undefined;
        } else {
          embed.thumbnail = { url: getAbsoluteOriginalUrl(member.customAvatarUrl) };
        }
      }

      const formData = new FormData();

      // Gerar e anexar a imagem visual das estatísticas se disponível
      if (statsPanelRef.current) {
        try {
          let blob = await generateStatsImageBlob(statsScale, exportFormat);

          if (blob) {
            const filename = `stats-${member.name.toLowerCase().replace(/\s+/g, '_')}_${exportFormat}.png`;
            formData.append('files[0]', blob, filename);
            embed.image = { url: `attachment://${filename}` };
          }
        } catch (imgErr) {
          console.error("Erro ao gerar imagem de estatísticas para o Discord:", imgErr);
        }
      }

      formData.append('payload_json', JSON.stringify({
        username: `${member.name} (Estatísticas)`,
        avatar_url: getAbsoluteOriginalUrl(member.customAvatarUrl || member.customEmbedThumbnail || ''),
        embeds: [embed]
      }));

      const res = await fetch(targetWebhook, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Webhook error');
      alert(`Estatísticas e Imagem de ${member.name} enviadas para o Discord com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar estatísticas para o Discord. Verifique a URL do Webhook.');
    } finally {
      setIsSyncingStats(false);
    }
  };

  const handleAdd = (cat: 'functions' | 'chars' | 'elements' | 'artifacts') => {
    onAddItem(member.name, cat, inputs[cat]);
    setInputs((prev) => ({ ...prev, [cat]: '' }));
  };

  const isExpelled = member.punishments.some((p: any) => p.type === 'expulsion');

  const cardSkin = getCardSkinClasses(member.customCardSkin, member.customGlowColor);
  const glowBorderClass = cardSkin.border;
  const customBgGradient = cardSkin.bg;

  return (
    <div className={`relative p-4 sm:p-6 ${isExpelled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`bento-card ${glowBorderClass} ${customBgGradient}`}>
        
      {/* Background Image */}
      {member.customBgUrl &&
        <div
          style={{
            backgroundImage: `url(${getProxiedUrl(member.customBgUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
          className="absolute inset-0 w-full h-full opacity-20 pointer-events-none z-0" />

        }
      {/* Removed large background text */}

      {/* Profile Header */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-start gap-4">
          {/* Profile Picture / Avatar Frame with custom illumination */}
          <div className="relative shrink-0 select-none">
            {/* Custom Lighting / Illumination under the avatar */}
            {resolvedAvatarGlow.extraElement}

            <div className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-bold transition-all duration-300 hover:scale-110 hover:rotate-3 relative z-10 ${
              resolvedAvatarGlow.container}`
              }>
              <div className={`w-full h-full flex items-center justify-center ${resolvedAvatarGlow.imgWrapper} ${
                member.customAvatarUrl ? '' :
                member.customGlowColor === 'cosmic-purple' ? 'bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-700' :
                member.customGlowColor === 'hellfire' ? 'bg-gradient-to-br from-red-600 via-orange-600 to-rose-700' :
                member.customGlowColor === 'divine-gold' ? 'bg-gradient-to-br from-amber-400 via-yellow-500 to-yellow-600' :
                member.customGlowColor === 'cyber-cyan' ? 'bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600' :
                member.customGlowColor === 'emerald-toxic' ? 'bg-gradient-to-br from-emerald-500 via-teal-600 to-green-700' :
                member.name === 'Asta' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-cyan-600'}`

                }>
                {member.customAvatarUrl ?
                  <div
                    style={{
                      backgroundImage: `url(${getProxiedUrl(member.customAvatarUrl)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                    className="w-full h-full" /> :


                  member.customAvatarSymbol || member.name[0]
                  }
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                  className={`text-xl font-bold tracking-tight leading-none ${nameGradientClasses}`}
                  style={{ fontFamily: nameFontFamily }}>
                  
                {customNameText}
              </h2>
              {member.customBadge &&
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider animate-pulse ${
                member.customBadgeColor === 'default' || !member.customBadgeColor ?
                member.customGlowColor === 'cosmic-purple' ? 'bg-purple-950/60 border-purple-500/40 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.3)]' :
                member.customGlowColor === 'hellfire' ? 'bg-red-950/60 border-red-500/40 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]' :
                member.customGlowColor === 'divine-gold' ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                member.customGlowColor === 'cyber-cyan' ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]' :
                member.customGlowColor === 'emerald-toxic' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                'bg-slate-800/80 border-slate-700 text-slate-300' :

                member.customBadgeColor === 'flame' ? 'skin-flame text-white border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]' :
                member.customBadgeColor === 'ice' ? 'skin-ice text-white border-sky-400/40 shadow-[0_0_8px_rgba(56,189,248,0.3)]' :
                member.customBadgeColor === 'nature' ? 'skin-nature text-white border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]' :
                member.customBadgeColor === 'void' ? 'skin-void text-white border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.3)]' :
                member.customBadgeColor === 'electric' ? 'skin-electric text-white border-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.3)]' :
                member.customBadgeColor === 'obsidian' ? 'skin-obsidian text-slate-200 border-slate-600/40 shadow-[0_0_8px_rgba(0,0,0,0.4)]' :
                member.customBadgeColor === 'gold' ? 'skin-gold text-white border-amber-400/40 shadow-[0_0_8px_rgba(245,158,11,0.4)]' :
                member.customBadgeColor === 'silver' ? 'skin-silver text-white border-slate-400/40 shadow-[0_0_8px_rgba(148,163,184,0.3)]' :
                member.customBadgeColor === 'rose' ? 'skin-rose text-white border-pink-400/40 shadow-[0_0_8px_rgba(244,114,182,0.3)]' :
                member.customBadgeColor === 'toxic' ? 'skin-toxic text-white border-lime-500/40 shadow-[0_0_8px_rgba(132,204,22,0.3)]' :
                member.customBadgeColor === 'blood' ? 'skin-blood text-white border-red-600/40 shadow-[0_0_8px_rgba(220,38,38,0.3)]' :
                member.customBadgeColor === 'ocean' ? 'skin-ocean text-white border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.3)]' :
                member.customBadgeColor === 'galaxy' ? 'skin-galaxy text-white border-fuchsia-500/40 shadow-[0_0_10px_rgba(217,70,239,0.4)]' :
                member.customBadgeColor === 'cyber' ? 'skin-cyber text-yellow-300 border-yellow-400/40 shadow-[0_0_8px_rgba(234,179,8,0.3)]' :
                member.customBadgeColor === 'ghost' ? 'skin-ghost text-white border-indigo-400/40 shadow-[0_0_8px_rgba(129,140,248,0.2)]' :
                member.customBadgeColor === 'magma' ? 'skin-magma text-white border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.3)]' :
                member.customBadgeColor === 'forest' ? 'skin-forest text-white border-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.2)]' :
                member.customBadgeColor === 'sunset' ? 'skin-sunset text-white border-orange-400/40 shadow-[0_0_8px_rgba(251,146,60,0.3)]' :
                member.customBadgeColor === 'neon-blue' ? 'skin-neon-blue text-white border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.5)]' :
                member.customBadgeColor === 'neon-green' ? 'skin-neon-green text-white border-green-400/40 shadow-[0_0_12px_rgba(74,222,128,0.5)]' :
                member.customBadgeColor === 'neon-red' ? 'skin-neon-red text-white border-red-500/40 shadow-[0_0_12px_rgba(248,113,113,0.5)]' :
                member.customBadgeColor === 'chrome' ? 'skin-chrome text-slate-100 border-slate-300 shadow-[0_0_10px_rgba(255,255,255,0.3)] font-extrabold' :
                member.customBadgeColor === 'vampire' ? 'skin-vampire text-rose-200 border-rose-950/80' :
                // Glow colors directly
                member.customBadgeColor === 'cosmic-purple' ? 'bg-purple-950/60 border-purple-500/40 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.3)]' :
                member.customBadgeColor === 'hellfire' ? 'bg-red-950/60 border-red-500/40 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]' :
                member.customBadgeColor === 'divine-gold' ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                member.customBadgeColor === 'cyber-cyan' ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]' :
                member.customBadgeColor === 'emerald-toxic' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                'bg-slate-800/80 border-slate-700 text-slate-300'}`

                }>
                  {member.customBadge}
                </span>
                }
            </div>
            
            {/* PLACAR DE MORTES E RESETS */}
            <div className="flex items-center gap-3 flex-wrap mt-1.5">
              {/* PLACAR DE MORTES PERSONALIZÁVEL */}
              <div className="flex items-center gap-2 shrink-0 select-none">
                <div
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 border transition-all duration-300 w-fit ${deathsGradientStyle.container}`}>
                    
                  <SelectedDeathsIcon size={14} className={`${deathsGradientStyle.icon} shrink-0`} />
                  <span
                      className={`text-[8.5px] font-black uppercase tracking-widest ${deathsGradientStyle.label}`}
                      style={{ fontFamily: deathsFontStyleFamily }}>
                      
                    {deathsLabelText}
                  </span>
                  <span
                      className={`text-sm font-black ${deathsGradientStyle.number}`}
                      style={{ fontFamily: deathsFontStyleFamily }}>
                      
                    {member.deaths || 0}
                  </span>
                </div>

                {/* Controles de Mortes (no-export) */}
                {deathsButtonsStyle !== 'hidden' &&
                  <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800/80 rounded-lg p-1 no-export shrink-0">
                    <button
                      onClick={() => onUpdateCustomSettings(member.name, { deaths: Math.max(0, (member.deaths || 0) - deathsMultiplier) })}
                      className="w-5 h-5 bg-red-950/80 border border-red-500/40 hover:bg-red-500 hover:text-black hover:border-red-500 rounded flex items-center justify-center text-[10px] font-black text-red-400 transition-all select-none active:scale-90 cursor-pointer"
                      title={`Diminuir ${deathsMultiplier}`}>
                      
                      -
                    </button>
                    <span className="text-[9px] font-black text-slate-300 px-0.5 font-mono">
                      {deathsMultiplier >= 1000000000 ? `${deathsMultiplier / 1000000000}B` : deathsMultiplier >= 1000000 ? `${deathsMultiplier / 1000000}M` : deathsMultiplier >= 1000 ? `${deathsMultiplier / 1000}k` : deathsMultiplier}
                    </span>
                    <button
                      onClick={() => onUpdateCustomSettings(member.name, { deaths: (member.deaths || 0) + deathsMultiplier })}
                      className="w-5 h-5 bg-red-950/80 border border-red-500/40 hover:bg-red-500 hover:text-black hover:border-red-500 rounded flex items-center justify-center text-[10px] font-black text-red-400 transition-all select-none active:scale-90 cursor-pointer"
                      title={`Aumentar ${deathsMultiplier}`}>
                      
                      +
                    </button>
                    <span className="text-[8px] font-bold text-slate-700 px-0.5 select-none">|</span>
                    <select
                      value={deathsMultiplier}
                      onChange={(e) => setDeathsMultiplier(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 text-slate-300 text-[9px] font-bold rounded px-1 py-0.5 focus:outline-none focus:border-purple-500/80 transition-all cursor-pointer hover:bg-slate-800"
                      title="Multiplicador">
                      
                      <option value={1}>1x</option>
                      <option value={10}>10x</option>
                      <option value={100}>100x</option>
                      <option value={1000}>1k</option>
                      <option value={10000}>10k</option>
                      <option value={100000}>100k</option>
                      <option value={1000000}>1M</option>
                    </select>
                  </div>
                  }
              </div>

              {/* COLUNINHA DE RESETS (Reset em cima, True Reset embaixo) */}
              <div className="flex flex-col gap-1.5 shrink-0">
                {/* PLACAR DE RESET (Roxo Vibrante) */}
                <div className="flex items-center gap-2 shrink-0 select-none">
                  <div
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 border border-purple-500/30 bg-purple-950/45 shadow-[0_0_8px_rgba(168,85,247,0.15)] hover:border-purple-500/60 transition-all duration-300 w-fit">
                      
                    <RotateCcw size={11} className="text-purple-400 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider text-purple-300 font-sans">
                      RESETS
                    </span>
                    <span className="text-xs font-black text-purple-400 filter drop-shadow-[0_0_4px_rgba(168,85,247,0.6)] font-mono">
                      {member.resets || 0}
                    </span>
                  </div>

                  {/* Controles de Reset (no-export) */}
                  <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800/80 rounded-lg p-1 no-export shrink-0">
                    <button
                        onClick={() => updateResetsStateAndText(member, Math.max(0, (member.resets || 0) - 1))}
                        className="w-4.5 h-4.5 bg-purple-950/80 border border-purple-500/40 hover:bg-purple-500 hover:text-black hover:border-purple-500 rounded flex items-center justify-center text-[9px] font-black text-purple-400 transition-all select-none active:scale-90 cursor-pointer"
                        title="Diminuir 1 Reset">
                        
                      -
                    </button>
                    <button
                        onClick={() => updateResetsStateAndText(member, (member.resets || 0) + 1)}
                        className="w-4.5 h-4.5 bg-purple-950/80 border border-purple-500/40 hover:bg-purple-500 hover:text-black hover:border-purple-500 rounded flex items-center justify-center text-[9px] font-black text-purple-400 transition-all select-none active:scale-90 cursor-pointer"
                        title="Aumentar 1 Reset">
                        
                      +
                    </button>
                    <span className="text-[8px] font-bold text-slate-700 px-0.5 select-none">|</span>
                    <button
                        onClick={() => handleReset(member)}
                        className="px-1.5 h-4.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[8px] font-extrabold uppercase transition-all select-none active:scale-90 cursor-pointer flex items-center justify-center"
                        title="Executar Reset Completo (Zera Nível e Exp)">
                        
                      ✨ Resetar
                    </button>
                  </div>
                </div>

                {/* PLACAR DE TRUE RESET (Roxo Escuro Profundo) */}
                <div className="flex items-center gap-2 shrink-0 select-none">
                  <div
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 border border-purple-900/60 bg-purple-950/85 shadow-[0_0_8px_rgba(147,51,234,0.2)] hover:border-purple-500/50 transition-all duration-300 w-fit">
                      
                    <Heart size={11} className="text-purple-400 fill-purple-500 animate-pulse shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider text-purple-300 font-sans">
                      TRUE RESET
                    </span>
                    <span className="text-xs font-black text-purple-300 filter drop-shadow-[0_0_4px_rgba(147,51,234,0.6)] font-mono">
                      {member.trueResets ? '✅' : '❌'}
                    </span>
                  </div>

                  {/* Controles de True Reset (no-export) */}
                  <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800/80 rounded-lg p-1 no-export shrink-0">
                    <button
                        onClick={() => updateTrueResetsStateAndText(member, 0)}
                        className={`w-4.5 h-4.5 rounded flex items-center justify-center text-[8px] font-black transition-all select-none active:scale-90 cursor-pointer ${
                        !member.trueResets ?
                        'bg-purple-600 text-white border border-purple-500' : 'bg-purple-950/80 border border-purple-500/40 text-purple-300 hover:bg-purple-900 hover:text-white'}`
                        }
                        title="Definir True Reset como Inativo (❌)">
                        
                      ❌
                    </button>
                    <button
                        onClick={() => updateTrueResetsStateAndText(member, 1)}
                        className={`w-4.5 h-4.5 rounded flex items-center justify-center text-[8px] font-black transition-all select-none active:scale-90 cursor-pointer ${
                        member.trueResets ?
                        'bg-purple-600 text-white border border-purple-500' : 'bg-purple-950/80 border border-purple-500/40 text-purple-300 hover:bg-purple-900 hover:text-white'}`
                        }
                        title="Definir True Reset como Ativo (✅)">
                        
                      ✅
                    </button>
                    <span className="text-[8px] font-bold text-slate-700 px-0.5 select-none">|</span>
                    <button
                        onClick={() => handleTrueReset(member)}
                        className="px-1.5 h-4.5 bg-purple-900 hover:bg-purple-800 text-purple-100 border border-purple-700 rounded text-[8px] font-extrabold uppercase transition-all select-none active:scale-90 cursor-pointer flex items-center justify-center"
                        title="Executar True Reset Completo (Limpa tudo)">
                        
                      💀 True Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 no-export">
          <button
              onClick={() => setShowCustomizer(!showCustomizer)}
              className="p-2 bg-slate-900/10 hover:bg-purple-950/40 border border-transparent hover:border-purple-500/40 text-slate-700 hover:text-purple-300 rounded-xl transition-all shadow-md hover:shadow-[0_0_15px_rgba(168,85,247,0.35)] active:scale-90 group/secret-btn relative cursor-pointer"
              title="Personalizar Card (Secreto)">
              
            <Sparkles size={13} className="animate-pulse group-hover/secret-btn:rotate-45 group-hover/secret-btn:scale-125 transition-transform duration-300" />
            <span className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 px-2.5 py-1 text-[9px] font-black tracking-wider text-purple-300 bg-slate-950 border border-purple-500/30 rounded-lg opacity-0 pointer-events-none group-hover/secret-btn:opacity-100 transition-all duration-200 whitespace-nowrap z-50 shadow-[0_0_15px_rgba(168,85,247,0.35)] uppercase font-mono">
              ✨ CONFIGURAÇÕES CÓSMICAS
            </span>
          </button>

          <button
              onClick={syncToDiscord}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-slate-300 text-[10px] font-bold uppercase rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50">
              
            {isSyncing ? <Loader2 size={12} className="animate-spin text-indigo-400" /> : <Send size={12} className="text-indigo-400" />}
            {isSyncing ? 'Sincronizando...' : 'Enviar Ficha'}
          </button>
        </div>
      </div>

      <div className="space-y-6 flex-1 relative z-10">
        <Section
            title="Funções"
            items={member.functions}
            value={inputs.functions}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, functions: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => onAddItem(member.name, 'functions', inputs.functions, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament)}
            onRemove={(id: string) => onRemoveItem(member.name, 'functions', id)}
            onUpdate={(id: string, data: any) => onUpdateItem(member.name, 'functions', id, data)}
            clearInput={() => setInputs((prev) => ({ ...prev, functions: '' }))}
            isSyncing={isSyncing}
            showLevel={true} />
          
        <Section
            title="Chars"
            items={member.chars}
            value={inputs.chars}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, chars: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => onAddItem(member.name, 'chars', inputs.chars, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament)}
            onRemove={(id: string) => onRemoveItem(member.name, 'chars', id)}
            onUpdate={(id: string, data: any) => onUpdateItem(member.name, 'chars', id, data)}
            clearInput={() => setInputs((prev) => ({ ...prev, chars: '' }))}
            isSyncing={isSyncing}
            showLevel={true} />
          
        <Section
            title="Elementos"
            items={member.elements}
            value={inputs.elements}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, elements: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => onAddItem(member.name, 'elements', inputs.elements, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament)}
            onRemove={(id: string) => onRemoveItem(member.name, 'elements', id)}
            onUpdate={(id: string, data: any) => onUpdateItem(member.name, 'elements', id, data)}
            clearInput={() => setInputs((prev) => ({ ...prev, elements: '' }))}
            isSyncing={isSyncing}
            showLevel={true} />
          
        <Section
            title="Artefatos"
            items={member.artifacts || []}
            value={inputs.artifacts}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, artifacts: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => onAddItem(member.name, 'artifacts', inputs.artifacts, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament)}
            onRemove={(id: string) => onRemoveItem(member.name, 'artifacts', id)}
            onUpdate={(id: string, data: any) => onUpdateItem(member.name, 'artifacts', id, data)}
            clearInput={() => setInputs((prev) => ({ ...prev, artifacts: '' }))}
            isSyncing={isSyncing}
            showLevel={true} />
          
        <Section
            title="Raças"
            items={member.races || []}
            value={inputs.races}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, races: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => onAddItem(member.name, 'races', inputs.races, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament)}
            onRemove={(id: string) => onRemoveItem(member.name, 'races', id)}
            onUpdate={(id: string, data: any) => onUpdateItem(member.name, 'races', id, data)}
            clearInput={() => setInputs((prev) => ({ ...prev, races: '' }))}
            isSyncing={isSyncing}
            showLevel={true}
            maxLevel={4} />
          
        <Section
            title="Ingredientes"
            items={member.ingredients || []}
            value={inputs.ingredients}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, ingredients: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => onAddItem(member.name, 'ingredients', inputs.ingredients, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament)}
            onRemove={(id: string) => onRemoveItem(member.name, 'ingredients', id)}
            onUpdate={(id: string, data: any) => onUpdateItem(member.name, 'ingredients', id, data)}
            clearInput={() => setInputs((prev) => ({ ...prev, ingredients: '' }))}
            isSyncing={isSyncing}
            showQuantity={true}
            showLevel={true} />
          
        <Section
            title="Formas"
            items={member.forms || []}
            value={inputs.forms}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, forms: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => onAddItem(member.name, 'forms', inputs.forms, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament)}
            onRemove={(id: string) => onRemoveItem(member.name, 'forms', id)}
            onUpdate={(id: string, data: any) => onUpdateItem(member.name, 'forms', id, data)}
            clearInput={() => setInputs((prev) => ({ ...prev, forms: '' }))}
            isSyncing={isSyncing}
            showLevel={true} />
          
        <Section
            title="Itens"
            items={member.items || []}
            value={inputs.items}
            onChange={(e: any) => setInputs((prev) => ({ ...prev, items: e.target.value }))}
            onAdd={(skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => onAddItem(member.name, 'items', inputs.items, skinId, rarityId, quantity, level, borderStyle, customBorderColor, ornament)}
            onRemove={(id: string) => onRemoveItem(member.name, 'items', id)}
            onUpdate={(id: string, data: any) => onUpdateItem(member.name, 'items', id, data)}
            clearInput={() => setInputs((prev) => ({ ...prev, items: '' }))}
            isSyncing={isSyncing}
            showLevel={true} />
          

        {/* Bounty Option */}
        <div className="group/section">
          <div className="sub-section-header">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Bounty</label>
            <button
                onClick={() => setShowBountyPicker(!showBountyPicker)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-slate-300 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer">
                
              {showBountyPicker ? <X size={11} /> : <Pencil size={11} />}
              {showBountyPicker ? 'Fechar' : 'Alterar'}
            </button>
          </div>
          
          <div className="flex flex-col gap-3">
            {showBountyPicker &&
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4 shadow-2xl">
                
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    autoFocus
                    className="input-bento h-9 text-[11px] flex-1 font-mono"
                    placeholder="Alterar valor do bounty..."
                    value={bountyInput}
                    onChange={(e) => setBountyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveBounty()} />
                  
                  <button
                    onClick={handleSaveBounty}
                    className="h-9 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/20 shrink-0 cursor-pointer">
                    
                    Confirmar
                  </button>
                </div>
              </motion.div>
              }

            <div className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 shadow-inner">
              <span className="text-3xl font-black text-yellow-500 select-none">$</span>
              <span className="text-2xl font-black text-amber-400 font-mono tracking-wider">
                {(member.bounty || 0).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>

        {/* Character RPG Statistics Panel */}
        <div id="rpg-stats-panel" ref={statsPanelRef} className="border border-slate-800/80 rounded-2xl p-4 bg-slate-900/40 relative overflow-hidden backdrop-blur-sm shadow-xl mt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
              Estatísticas Atuais
              <button
                  onClick={() => setShowCustomizer(!showCustomizer)}
                  className="opacity-20 hover:opacity-100 focus:opacity-100 text-slate-500 hover:text-purple-400 ml-1.5 p-0.5 rounded transition-all cursor-pointer no-export"
                  title="Personalizar Card (Secreto)">
                  
                <Sparkles size={11} className="animate-pulse" />
              </button>
            </span>
            <div className="flex gap-1.5 flex-wrap items-center no-export">
              {member.statsText &&
                <>
                  <button
                    onClick={() => setOnlyRelevantStats(!onlyRelevantStats)}
                    className={`text-[9px] font-bold px-2 py-1 border rounded-lg transition-all uppercase flex items-center gap-1 active:scale-95 cursor-pointer ${
                    onlyRelevantStats ?
                    'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 shadow-[0_0_8px_rgba(6,182,212,0.15)]' :
                    'bg-slate-800 border-slate-700/50 text-slate-400 hover:text-slate-200'}`
                    }
                    title={onlyRelevantStats ? "Mostrando apenas estatísticas principais. Clique para exibir todas." : "Mostrando todas as estatísticas. Clique para filtrar estatísticas relevantes."}>
                    
                    {onlyRelevantStats ? '🎯 Relevantes' : '🌐 Todos'}
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenExportModal) {
                        onOpenExportModal(member.name);
                      } else {
                        setShowPreviewModal(true);
                      }
                    }}
                    className="text-[9px] font-bold px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-600 border border-indigo-500/40 hover:border-indigo-400 rounded-lg text-indigo-300 hover:text-white transition-all uppercase flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                    title="Abrir opções de exportação de imagem (PC/Celular, resolução, pré-imagem e envio para o Discord)">
                    
                    <Camera size={11} className="text-indigo-300" />
                    📸 Exportar & Discord
                  </button>
                </>
                }
              <button
                  onClick={() => {
                    setIsEditingStats(!isEditingStats);
                    if (!showStats) setShowStats(true);
                  }}
                  className="text-[9px] font-bold px-2 py-1 bg-slate-800 border border-slate-700/50 hover:border-indigo-500/40 rounded-lg text-slate-300 transition-all uppercase cursor-pointer">
                  
                {isEditingStats ? 'Ver Status' : 'Editar'}
              </button>
              <button
                  onClick={() => setShowStats(!showStats)}
                  className="text-[9px] font-bold px-2 py-1 bg-slate-800 border border-slate-700/50 hover:border-indigo-500/40 rounded-lg text-slate-300 transition-all uppercase cursor-pointer">
                  
                {showStats ? 'Recolher' : 'Expandir'}
              </button>
            </div>
          </div>



          <AnimatePresence initial={false}>
            {showStats &&
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden">
                
                {isEditingStats && !isSyncing && !isSyncingStats ?
                <div className="space-y-3 pt-2">
                    <textarea
                    value={editedStatsText}
                    onChange={(e) => setEditedStatsText(e.target.value)}
                    className="w-full h-72 bg-slate-950 border border-slate-800/80 rounded-xl p-3 font-mono text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500/50"
                    placeholder="Cole as estatísticas formatadas aqui..." />
                  
                    <div className="flex gap-2 justify-end">
                      {(member.name === 'Nkleozin' || member.name === 'Afogz' || member.name === 'Asta') &&
                    <div className="mr-auto flex gap-1.5">
                          <button
                        onClick={() => {
                          const defaultText = member.name === 'Nkleozin' ? NK_STATS_DEFAULT : member.name === 'Afogz' ? AFOGZ_STATS_DEFAULT : ASTA_STATS_DEFAULT;
                          setEditedStatsText(defaultText);
                          onUpdateStatsText(member.name, defaultText);
                          setIsEditingStats(false);
                        }}
                        className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all border border-amber-500/30">
                        
                            Restaurar Padrão
                          </button>
                          <button
                        onClick={() => {
                          const confirmReset = window.confirm(`Deseja realmente ZERAR todas as informações de ${member.name}? Isso apagará todos os itens, funções, chars, elementos, resets, mortes, e definirá o Bounty de volta para 0.`);
                          if (!confirmReset) return;

                          const defaultText = member.name === 'Nkleozin' ? NK_STATS_DEFAULT : member.name === 'Afogz' ? AFOGZ_STATS_DEFAULT : ASTA_STATS_DEFAULT;
                          setEditedStatsText(defaultText);
                          onUpdateStatsText(member.name, defaultText);
                          onUpdateCustomSettings(member.name, {
                            functions: [],
                            chars: [],
                            elements: [],
                            artifacts: [],
                            races: [],
                            ingredients: [],
                            forms: [],
                            items: [],
                            punishments: [],
                            deaths: 0,
                            bounty: 0,
                            resets: 0,
                            trueResets: 0,
                            customAvatarUrl: undefined,
                            customBgUrl: undefined,
                            customGlowColor: 'default',
                            threatColor: 'default',
                            mainStatsColor: 'default',
                            kiCardColor: 'default',
                            ipPartCardColor: 'default',
                            temperatureCardColor: 'default',
                            customCardSkin: 'none',
                            avatarGlow: 'none'
                          });
                          setIsEditingStats(false);
                        }}
                        className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all border border-rose-500/30">
                        
                            🚨 Zerar Tudo
                          </button>
                        </div>
                    }
                      <button
                      onClick={() => {
                        onUpdateStatsText(member.name, editedStatsText);
                        setIsEditingStats(false);
                      }}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all">
                      
                        Salvar
                      </button>
                      <button
                      onClick={() => {
                        setEditedStatsText(member.statsText || '');
                        setIsEditingStats(false);
                      }}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all">
                      
                        Cancelar
                      </button>
                    </div>
                  </div> :

                <div className="pt-2">
                    {member.statsText ?
                  <div
                    className={`grid gap-2 ${
                    isCapturingForImage || isSyncingStats || isExportingStatsImage ?
                    exportFormat === 'mobile' ? 'grid-cols-1' : 'grid-cols-2' : 'grid-cols-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar'}`
                    }
                    style={isCapturingForImage || isSyncingStats || isExportingStatsImage ? { maxHeight: 'none', overflow: 'visible' } : undefined}>
                    
                        {(() => {
                      const ALWAYS_SHOW_KEYWORDS = [
                      'potencia', 'potência', 'resistencia', 'resistência', 'recistencia', 'recistência',
                      'ki', 'tipo de ip', 'nivel', 'nível', 'level', 'parte do ip', 'funções', 'funcoes', 'sistema', 'ameaça', 'ameaca', 'temperatura',
                      'exp', 'kills', 'gang', 'shiks', 'bankai', 'estilo atual', 'habilidade habilidosa', 'bugcrowd', 'bug crowd', 'núcleo', 'nucleo', 'classe'];

                      const parsedAll = parseStats(member.statsText);
                      const statsList = parsedAll.filter((item: any) => {
                        if (!onlyRelevantStats) return true;
                        if (item.type === 'header' || item.type === 'text') return true;
                        if (item.type === 'empty' || item.type === 'divider') return false;
                        if (item.type === 'stat') {
                          const labelStr = item.label || '';
                          const valStr = item.value || '';
                          const labelLower = labelStr.toLowerCase().trim();
                          const isCore = ALWAYS_SHOW_KEYWORDS.some((k) => labelLower === k || labelLower.includes(k));
                          if (isCore) return true;

                          const valLower = valStr.toLowerCase().trim();
                          const isUnsetVal = [
                          'none', 'none.', '0', '0%', 'bloqueado', 'bloqueado.',
                          'canonic', 'canonic.', 'knonic', 'knonic.', '𝐧𝐨𝐧𝐞', 'nenhum', '❌'].
                          includes(valLower);
                          return !isUnsetVal;
                        }
                        return true;
                      });

                      const isSingleCol = exportFormat === 'mobile' && (isCapturingForImage || isSyncingStats || isExportingStatsImage);

                      return statsList.map((item: any, idx: number) => {
                        if (item.type === 'empty') return null;
                        if (item.type === 'divider') {
                          return <div key={idx} className={`border-t border-slate-800/60 my-2 ${isSingleCol ? 'col-span-1' : 'col-span-2'}`} />;
                        }
                        if (item.type === 'header') {
                          return (
                            <div key={idx} className={`mt-2 mb-1 ${isSingleCol ? 'col-span-1' : 'col-span-2'}`}>
                                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 bg-indigo-950/20 px-2 py-1 rounded-md border border-indigo-950/30">
                                    {item.text}
                                  </h4>
                                </div>);

                        }
                        if (item.type === 'text') {
                          return (
                            <div key={idx} className={`text-[10px] text-slate-400 italic bg-slate-950/30 p-1.5 rounded border border-slate-900 font-mono ${isSingleCol ? 'col-span-1' : 'col-span-2'}`}>
                                  {item.text}
                                </div>);

                        }

                        // Type stat: glowy visual cards
                        const valStr = item.value || '';
                        const labelStr = item.label || '';
                        const isMax = valStr.toLowerCase().includes('max') || valStr.toLowerCase().includes('1e+100');
                        const isNone = valStr.toLowerCase() === 'none' || valStr === ' canonic ' || valStr === 'Canonic' || valStr === '𝐍𝐨𝐧𝐞' || valStr === '0' || valStr === '0%';
                        const isThreat = labelStr.toLowerCase().includes('ameaça');
                        const isKi = labelStr.trim().toLowerCase() === 'ki';
                        const isIpPart = labelStr.trim().toLowerCase() === 'parte do ip' || labelStr.trim().toLowerCase() === 'parte de ip';
                        const isTemperature = labelStr.trim().toLowerCase() === 'temperatura';

                        let cardStyles = 'border-slate-800/80 hover:border-indigo-500/40';
                        let labelStyles = 'text-slate-500';
                        let valueStyles = 'text-indigo-300 group-hover/stat:text-white';

                        const threatColorVal = member.threatColor || 'default';
                        const mainStatsColorVal = member.mainStatsColor || 'default';
                        const kiCardColorVal = member.kiCardColor || 'default';
                        const ipPartCardColorVal = member.ipPartCardColor || 'default';
                        const temperatureCardColorVal = member.temperatureCardColor || 'default';

                        const selectedThreatStyle = THREAT_STYLES[threatColorVal] || THREAT_STYLES['default'];
                        const selectedMainStatsStyle = MAIN_STAT_STYLES[mainStatsColorVal] || MAIN_STAT_STYLES['default'];
                        const selectedKiStyle = MAIN_STAT_STYLES[kiCardColorVal] || MAIN_STAT_STYLES['default'];
                        const selectedIpPartStyle = MAIN_STAT_STYLES[ipPartCardColorVal] || MAIN_STAT_STYLES['default'];

                        let selectedTemperatureStyle = MAIN_STAT_STYLES[temperatureCardColorVal] || MAIN_STAT_STYLES['default'];

                        if (isTemperature && temperatureCardColorVal === 'default') {
                          // Auto detect based on threshold
                          const match = item.value.match(/-?\d+(\.\d+)?/);
                          const tempNum = match ? parseFloat(match[0]) : null;
                          if (tempNum !== null) {
                            if (tempNum < 15) {
                              selectedTemperatureStyle = MAIN_STAT_STYLES['frost-ice'];
                            } else if (tempNum > 30) {
                              selectedTemperatureStyle = MAIN_STAT_STYLES['magma-orange'];
                            }
                          }
                        }

                        if (isThreat) {
                          cardStyles = selectedThreatStyle.card;
                          labelStyles = selectedThreatStyle.label;
                          valueStyles = selectedThreatStyle.value;
                        } else if (isKi) {
                          cardStyles = selectedKiStyle.card;
                          labelStyles = selectedKiStyle.label;
                          valueStyles = selectedKiStyle.value;
                        } else if (isIpPart) {
                          cardStyles = selectedIpPartStyle.card;
                          labelStyles = selectedIpPartStyle.label;
                          valueStyles = selectedIpPartStyle.value;
                        } else if (isTemperature) {
                          cardStyles = selectedTemperatureStyle.card;
                          labelStyles = selectedTemperatureStyle.label;
                          valueStyles = selectedTemperatureStyle.value;
                        } else if (isMax) {
                          cardStyles = 'border-amber-500/30 bg-amber-500/[0.02] hover:border-amber-500/50';
                          labelStyles = 'text-slate-500';
                          valueStyles = 'text-amber-400 group-hover/stat:text-amber-300 font-extrabold';
                        } else if (isNone) {
                          cardStyles = 'border-slate-800/40 opacity-70 hover:opacity-100 hover:border-slate-700';
                          labelStyles = 'text-slate-500';
                          valueStyles = 'text-slate-400 group-hover/stat:text-slate-300';
                        } else {
                          cardStyles = selectedMainStatsStyle.card;
                          labelStyles = selectedMainStatsStyle.label;
                          valueStyles = selectedMainStatsStyle.value;
                        }

                        return (
                          <div
                            key={idx}
                            className={`bg-slate-950/50 border rounded-xl p-2 transition-all flex flex-col justify-between group/stat shadow-inner relative ${cardStyles}`}>
                            
                                {isThreat && selectedThreatStyle.thumbnail &&
                            <img
                              src={selectedThreatStyle.thumbnail.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(selectedThreatStyle.thumbnail)}` : selectedThreatStyle.thumbnail}
                              className="w-7 h-7 object-contain absolute right-2 top-2 rounded animate-pulse"
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous" />

                            }
                                {isThreat && !selectedThreatStyle.thumbnail &&
                            <span className={`w-1.5 h-1.5 rounded-full animate-ping absolute right-2 top-2 ${selectedThreatStyle.ping}`}></span>
                            }
                                <span className={`text-[8px] font-extrabold uppercase tracking-widest truncate ${labelStyles}`}>
                                  {item.label}
                                </span>
                                <span className={`text-[11px] font-mono font-bold tracking-tight mt-0.5 select-all transition-colors truncate ${valueStyles}`}>
                                  {item.value}
                                </span>
                              </div>);

                      });
                    })()}
                      </div> :

                  <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                        <p className="text-[10px] text-slate-500 mb-2">Este membro não possui estatísticas RPG configuradas.</p>
                        <button
                      onClick={() => {
                        const defaultText = member.name === 'Nkleozin' ? NK_STATS_DEFAULT : member.name === 'Afogz' ? AFOGZ_STATS_DEFAULT : member.name === 'Asta' ? ASTA_STATS_DEFAULT : `Estatísticas Atuais.\n${member.name}\n➳ Nivel = 1\n➳ Exp = 0\n➳ Classe = D`;
                        onUpdateStatsText(member.name, defaultText);
                        setIsEditingStats(true);
                      }}
                      className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all border border-indigo-500/20">
                      
                          + Ativar Estatísticas
                        </button>
                      </div>
                  }
                  </div>
                }
              </motion.div>
              }
          </AnimatePresence>
        </div>

        {/* Modal de Exportação de Imagem & Webhook Discord */}
        <AnimatePresence>
          {showPreviewModal &&
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 no-export">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full p-5 shadow-2xl relative flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Camera size={18} className="text-cyan-400" />
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
                        Opções de Exportação & Webhook
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                          {member.name}
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-400">Personalize o formato da imagem (PC/Celular), resolução e envie diretamente pro Discord</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer">
                    
                    <X size={18} />
                  </button>
                </div>

                {/* Controles de Configuração */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-[11px]">
                  
                  {/* Formato Dispositivo */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Monitor size={12} className="text-cyan-400" /> Formato / Layout
                    </span>
                    <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setExportFormat('pc')}
                        className={`py-1.5 px-2 rounded-md font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        exportFormat === 'pc' ? 'bg-indigo-600 text-white shadow-sm font-extrabold' : 'text-slate-400 hover:text-slate-200'}`
                        }>
                        
                        <Monitor size={11} /> 💻 PC (2 Cols)
                      </button>
                      <button
                        onClick={() => setExportFormat('mobile')}
                        className={`py-1.5 px-2 rounded-md font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        exportFormat === 'mobile' ? 'bg-indigo-600 text-white shadow-sm font-extrabold' : 'text-slate-400 hover:text-slate-200'}`
                        }>
                        
                        <Smartphone size={11} /> 📱 Celular (1 Col)
                      </button>
                    </div>
                  </div>

                  {/* Resolução */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={12} className="text-purple-400" /> Resolução
                    </span>
                    <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setStatsScale(1.5)}
                        className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                        statsScale === 1.5 ?
                        'bg-purple-600 text-white shadow-sm font-extrabold' :
                        'text-slate-400 hover:text-slate-200'}`
                        }>
                        
                        1.5x HD
                      </button>
                      <button
                        onClick={() => setStatsScale(2.5)}
                        className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                        statsScale === 2.5 ?
                        'bg-purple-600 text-white shadow-sm font-extrabold' :
                        'text-slate-400 hover:text-slate-200'}`
                        }>
                        
                        2.5x HD
                      </button>
                      <button
                        onClick={() => setStatsScale(4.0)}
                        className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                        statsScale === 4.0 ?
                        'bg-purple-600 text-white shadow-sm font-extrabold' :
                        'text-slate-400 hover:text-slate-200'}`
                        }>
                        
                        4x Ultra
                      </button>
                    </div>
                  </div>

                  {/* Filtro de Stats */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Sliders size={12} className="text-emerald-400" /> Conteúdo
                    </span>
                    <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setOnlyRelevantStats(true)}
                        className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                        onlyRelevantStats ?
                        'bg-emerald-600 text-white shadow-sm font-extrabold' :
                        'text-slate-400 hover:text-slate-200'}`
                        }>
                        
                        🎯 Relevantes
                      </button>
                      <button
                        onClick={() => setOnlyRelevantStats(false)}
                        className={`py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                        !onlyRelevantStats ?
                        'bg-emerald-600 text-white shadow-sm font-extrabold' :
                        'text-slate-400 hover:text-slate-200'}`
                        }>
                        
                        🌐 Todos
                      </button>
                    </div>
                  </div>

                </div>

                {/* Pré Imagem Preview Area */}
                <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800/80 flex flex-col items-center justify-center min-h-[240px] max-h-[50vh] overflow-auto relative">
                  {isGeneratingPreview ?
                  <div className="flex flex-col items-center gap-2 text-cyan-400 py-12">
                      <Loader2 size={26} className="animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-wider">Gerando Pré-Imagem HD ({exportFormat === 'mobile' ? '📱 Celular' : '💻 PC'}, {statsScale}x)...</span>
                    </div> :
                  previewStatsUrl ?
                  <img
                    src={previewStatsUrl}
                    alt={`Pré-imagem Estatísticas ${member.name}`}
                    className="max-w-full h-auto rounded-lg shadow-2xl object-contain border border-slate-800" /> :


                  <span className="text-slate-500 text-xs">Nenhuma pré-imagem gerada.</span>
                  }
                </div>

                {/* Botões de Ação Final */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 flex-wrap gap-2">
                  <span className="text-[10px] text-slate-500 italic">
                    ✨ Imagem renderizada inteira sem barras de rolagem.
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleDownloadStatsImage}
                      disabled={isExportingStatsImage}
                      className="px-3.5 py-2 bg-emerald-950/70 border border-emerald-500/40 hover:bg-emerald-900/80 rounded-xl text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50">
                      
                      {isExportingStatsImage ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                      Baixar PNG ({statsScale}x)
                    </button>
                    <button
                      onClick={handleCopyStatsImage}
                      disabled={isExportingStatsImage}
                      className="px-3.5 py-2 bg-purple-950/70 border border-purple-500/40 hover:bg-purple-900/80 rounded-xl text-purple-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50">
                      
                      <Copy size={13} />
                      Copiar Imagem
                    </button>
                    <button
                      onClick={syncStatsToDiscord}
                      disabled={isSyncingStats}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95 disabled:opacity-50">
                      
                      {isSyncingStats ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {isSyncingStats ? 'Enviando...' : 'Enviar pro Discord'}
                    </button>
                  </div>
                </div>

              </motion.div>
            </div>
            }
        </AnimatePresence>
      </div>

      {/* Punishments Footer Section */}
      <footer className="mt-8 pt-6 border-t border-slate-800 relative z-10 no-export">
        <div className="flex justify-between items-center mb-4 no-export">
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Controles de Segurança</span>
           <div className="flex gap-2">
              <button
                onClick={() => {
                  const reason = window.prompt("Motivo da Advertência?");
                  if (reason) onAddPunishment(member.name, 'warning', reason);
                }}
                className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/20 px-2 py-1 rounded hover:bg-amber-500 hover:text-white transition-all uppercase">
                
                Advertir
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt("Confirma a EXPULSÃO? Motivo?");
                  if (reason) onAddPunishment(member.name, 'expulsion', reason);
                }}
                className="text-[9px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/20 px-2 py-1 rounded hover:bg-rose-600 hover:text-white transition-all uppercase">
                
                Expulsar
              </button>
           </div>
        </div>
        
        {member.punishments.length > 0 &&
          <div className="space-y-2">
            {member.punishments.map((p) =>
            <div key={p.id} className={`flex justify-between items-center p-2 rounded-lg border text-[10px] font-mono ${
            p.type === 'expulsion' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`
            }>
                <span className="truncate max-w-[150px]">{p.reason}</span>
                <span className="opacity-50">{p.date}</span>
                <button onClick={() => onRemovePunishment(member.name, p.id)} className="ml-2 hover:text-white no-export">×</button>
              </div>
            )}
          </div>
          }

        <div className="flex justify-between text-[10px] font-bold text-slate-600 mt-4 uppercase tracking-tighter">
          <span>UID: {Math.abs(member.name.split('').reduce((a, b) => a + b.charCodeAt(0), 0))}-SYS</span>
          <span className={isExpelled ? 'text-rose-500' : 'text-emerald-500'}>ESTADO: {isExpelled ? 'EXPULSO' : 'ATIVO'}</span>
        </div>
      </footer>
    </motion.div>

    <AnimatePresence initial={false)>
      {showCustomizer &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border border-purple-500/20 bg-purple-950/15 rounded-2xl p-5 mt-4 space-y-3 no-export relative overflow-hidden backdrop-blur-sm shadow-xl">
          
          <div className="absolute top-0 right-0 p-1 opacity-[0.05] pointer-events-none">
            <Sparkles size={36} className="text-purple-500" />
          </div>
          
          <div className="flex items-center justify-between border-b border-purple-900/30 pb-1.5">
            <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1">
              🌌 CUSTOMIZAÇÃO CÓSMICA
            </span>
            <button
              onClick={() => setShowCustomizer(false)}
              className="text-slate-500 hover:text-white text-[9px] font-bold uppercase">
              
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Custom Title Badge */}
            <div>
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                Cargo / Título
              </label>
              <input
                type="text"
                value={member.customBadge || ''}
                onChange={(e) => onUpdateCustomSettings(member.name, { customBadge: e.target.value })}
                placeholder="Ex: Soberano, Admin, Rank S"
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
              
            </div>

            {/* PLACAR DE MORTE EDIT */}
            <div>
              <label className="text-[8px] font-extrabold text-red-400 uppercase tracking-wider block mb-1">
                ☠️ Contador de Mortes
              </label>
              <input
                type="number"
                min="0"
                value={member.deaths !== undefined ? member.deaths : 0}
                onChange={(e) => onUpdateCustomSettings(member.name, { deaths: parseInt(e.target.value) || 0 })}
                placeholder="Ex: 0"
                className="w-full bg-slate-950/80 border border-red-900/30 hover:border-red-500/30 focus:border-red-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-red-400 font-mono focus:outline-none transition-all" />
              
            </div>

            {/* THREAT (AMEAÇA) EDIT */}
            <div>
              <label className="text-[8px] font-extrabold text-purple-400 uppercase tracking-wider block mb-1">
                🌌 Nível de Ameaça
              </label>
              <input
                type="text"
                value={getThreatValue(member.statsText || '')}
                onChange={(e) => {
                  const updatedText = updateThreatValue(member.statsText || '', e.target.value);
                  onUpdateStatsText(member.name, updatedText);
                }}
                placeholder="Ex: Cósmico, Calamidade 🌌"
                className="w-full bg-slate-950/80 border border-purple-900/30 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-purple-300 font-mono focus:outline-none transition-all" />
              
            </div>

            {/* COR DO NÍVEL DE AMEAÇA SELECT */}
            <div>
              <label className="text-[8px] font-extrabold text-purple-400 uppercase tracking-wider block mb-1">
                🎨 Tema do Nível de Ameaça
              </label>
              <select
                value={member.threatColor || 'default'}
                onChange={(e) => onUpdateCustomSettings(member.name, { threatColor: e.target.value })}
                className="w-full bg-slate-950 border border-purple-900/40 focus:border-purple-500 rounded-lg px-2 py-1.5 text-[10px] text-purple-300 font-mono focus:outline-none transition-all cursor-pointer">
                
                <option value="default">Padrão Clássico ⚡</option>
                <option value="lowers">1 - Lowers 🛡️</option>
                <option value="intermediate">2 - Intermediate ⚔️</option>
                <option value="hoher-rang">3 - Hoher Rang 🔥</option>
                <option value="zusatzlich">4 - Zusatzlich 👑</option>
              </select>
            </div>

            {/* COR DOS CARDS PRINCIPAIS (Potência, Nível, etc.) SELECT */}
            <div>
              <label className="text-[8px] font-extrabold text-cyan-400 uppercase tracking-wider block mb-1">
                ⚡ Tema dos Cards Principais (Potência, Nível, etc.)
              </label>
              <select
                value={member.mainStatsColor || 'default'}
                onChange={(e) => onUpdateCustomSettings(member.name, { mainStatsColor: e.target.value })}
                className="w-full bg-slate-950 border border-cyan-900/40 focus:border-cyan-500 rounded-lg px-2 py-1.5 text-[10px] text-cyan-300 font-mono focus:outline-none transition-all cursor-pointer">
                
                <option value="default">Padrão (Índigo / Cinza) ⚡</option>
                <option value="cyber-cyan">Ciano Cibernético 🤖</option>
                <option value="cosmic-purple">Roxo Cósmico 🌌</option>
                <option value="hellfire-red">Vermelho Infernal 🔥</option>
                <option value="divine-gold">Ouro Divino 👑</option>
                <option value="emerald-toxic">Verde Tóxico ☣️</option>
                <option value="hyper-pink">Rosa Choque 💖</option>
                <option value="ocean-blue">Azul Oceano 🌊</option>
                <option value="magma-orange">Laranja Magma 🌋</option>
                <option value="rainbow-prism">Arco-Íris Prisma 🌈</option>
                <option value="obsidian-dark">Obscuro Ônix 🖤</option>
                <option value="aurora">Aurora Boreal 🌌💚</option>
              </select>
            </div>

            {/* COR DO CARD DE KI SELECT */}
            <div>
              <label className="text-[8px] font-extrabold text-indigo-400 uppercase tracking-wider block mb-1">
                ✨ Tema Específico do Card de Ki
              </label>
              <select
                value={member.kiCardColor || 'default'}
                onChange={(e) => onUpdateCustomSettings(member.name, { kiCardColor: e.target.value })}
                className="w-full bg-slate-950 border border-indigo-900/40 focus:border-indigo-500 rounded-lg px-2 py-1.5 text-[10px] text-indigo-300 font-mono focus:outline-none transition-all cursor-pointer">
                
                <option value="default">Seguir Tema Principal / Padrão ⚡</option>
                <option value="cyber-cyan">Ciano Cibernético 🤖</option>
                <option value="cosmic-purple">Roxo Cósmico 🌌</option>
                <option value="hellfire-red">Vermelho Infernal 🔥</option>
                <option value="divine-gold">Ouro Divino 👑</option>
                <option value="emerald-toxic">Verde Tóxico ☣️</option>
                <option value="hyper-pink">Rosa Choque 💖</option>
                <option value="ocean-blue">Azul Oceano 🌊</option>
                <option value="magma-orange">Laranja Magma 🌋</option>
                <option value="rainbow-prism">Arco-Íris Prisma 🌈</option>
                <option value="obsidian-dark">Obscuro Ônix 🖤</option>
                <option value="aurora">Aurora Boreal 🌌💚</option>
              </select>
            </div>

            {/* COR DO CARD DE PARTE DO IP SELECT */}
            <div>
              <label className="text-[8px] font-extrabold text-emerald-400 uppercase tracking-wider block mb-1">
                ✨ Tema Específico do Card de Parte do IP
              </label>
              <select
                value={member.ipPartCardColor || 'default'}
                onChange={(e) => onUpdateCustomSettings(member.name, { ipPartCardColor: e.target.value })}
                className="w-full bg-slate-950 border border-emerald-900/40 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-[10px] text-emerald-300 font-mono focus:outline-none transition-all cursor-pointer">
                
                <option value="default">Seguir Tema Principal / Padrão ⚡</option>
                <option value="cyber-cyan">Ciano Cibernético 🤖</option>
                <option value="cosmic-purple">Roxo Cósmico 🌌</option>
                <option value="hellfire-red">Vermelho Infernal 🔥</option>
                <option value="divine-gold">Ouro Divino 👑</option>
                <option value="emerald-toxic">Verde Tóxico ☣️</option>
                <option value="hyper-pink">Rosa Choque 💖</option>
                <option value="ocean-blue">Azul Oceano 🌊</option>
                <option value="magma-orange">Laranja Magma 🌋</option>
                <option value="rainbow-prism">Arco-Íris Prisma 🌈</option>
                <option value="obsidian-dark">Obscuro Ônix 🖤</option>
                <option value="aurora">Aurora Boreal 🌌💚</option>
              </select>
            </div>

            {/* COR DO CARD DE TEMPERATURA SELECT */}
            <div>
              <label className="text-[8px] font-extrabold text-sky-400 uppercase tracking-wider block mb-1">
                ❄️ Tema do Card de Temperatura
              </label>
              <select
                value={member.temperatureCardColor || 'default'}
                onChange={(e) => onUpdateCustomSettings(member.name, { temperatureCardColor: e.target.value })}
                className="w-full bg-slate-950 border border-sky-900/40 focus:border-sky-500 rounded-lg px-2 py-1.5 text-[10px] text-sky-300 font-mono focus:outline-none transition-all cursor-pointer">
                
                <option value="default">Automático (Gelo &lt; 15°C / Fogo &gt; 30°C) ❄️🔥</option>
                <option value="cyber-cyan">Ciano Cibernético 🤖</option>
                <option value="cosmic-purple">Roxo Cósmico 🌌</option>
                <option value="hellfire-red">Vermelho Infernal 🔥</option>
                <option value="divine-gold">Ouro Divino 👑</option>
                <option value="emerald-toxic">Verde Tóxico ☣️</option>
                <option value="hyper-pink">Rosa Choque 💖</option>
                <option value="ocean-blue">Azul Oceano 🌊</option>
                <option value="magma-orange">Laranja Magma 🌋</option>
                <option value="rainbow-prism">Arco-Íris Prisma 🌈</option>
                <option value="obsidian-dark">Obscuro Ônix 🖤</option>
                <option value="aurora">Aurora Boreal 🌌💚</option>
                <option value="frost-ice">Glacial Eterno ❄️</option>
                <option value="abyss-void">Vazio do Abismo 🌑</option>
                <option value="plasma-purple">Tempestade de Plasma ⚡💜</option>
                <option value="corrupted">Divindade Corrompida 🩸</option>
              </select>
            </div>

            {/* 2. Custom Avatar Symbol */}
            <div>
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                Ícone do Avatar (Letras ou Emoji)
              </label>
              <input
                type="text"
                value={member.customAvatarSymbol || ''}
                maxLength={3}
                onChange={(e) => onUpdateCustomSettings(member.name, { customAvatarSymbol: e.target.value })}
                placeholder="Ex: 👑, ★, NK, @"
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
              
            </div>

            {/* 2c. Custom Avatar Image URL */}
            <div className="col-span-1 sm:col-span-2">
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                URL da Imagem do Avatar (Foto de Perfil no Painel)
              </label>
              <input
                type="text"
                value={member.customAvatarUrl || ''}
                onChange={(e) => onUpdateCustomSettings(member.name, { customAvatarUrl: e.target.value })}
                placeholder="Ex: https://i.imgur.com/link_da_foto.png"
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
              
            </div>

            {/* 2d. Custom Background Image URL */}
            <div className="col-span-1 sm:col-span-2">
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                URL da Imagem de Fundo (Plano de Fundo do Card no Painel)
              </label>
              <input
                type="text"
                value={member.customBgUrl || ''}
                onChange={(e) => onUpdateCustomSettings(member.name, { customBgUrl: e.target.value })}
                placeholder="Ex: https://i.imgur.com/link_do_fundo.png"
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
              
            </div>

            {/* 2b. Custom Embed Thumbnail URL */}
            <div className="col-span-1 sm:col-span-2">
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                URL da Imagem do Topo do Embed (Foto Transparente / Miniatura no Discord)
              </label>
              <input
                type="text"
                value={member.customEmbedThumbnail || ''}
                onChange={(e) => onUpdateCustomSettings(member.name, { customEmbedThumbnail: e.target.value })}
                placeholder="Ex: https://i.imgur.com/link_da_imagem_transparente.png"
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
              
            </div>

            {/* 2e. Custom Embed Banner URL (GIF / Static) */}
            <div className="col-span-1 sm:col-span-2">
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                URL do Banner do Embed (GIF Animado ou Imagem Grande no Discord)
              </label>
              <input
                type="text"
                value={member.customEmbedBanner || ''}
                onChange={(e) => onUpdateCustomSettings(member.name, { customEmbedBanner: e.target.value })}
                placeholder="Ex: https://media.giphy.com/media/.../giphy.gif"
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
              
            </div>

            {/* 2f. Custom Embed Color */}
            <div className="col-span-1 sm:col-span-2">
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                Cor da Borda do Embed (Discord)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={member.customEmbedColor || ''}
                  onChange={(e) => onUpdateCustomSettings(member.name, { customEmbedColor: e.target.value })}
                  placeholder="Ex: #ff0055 (Padrão: Baseado no Brilho/Skin)"
                  className="flex-1 bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                
                <div className="relative w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-slate-800 hover:border-purple-500/30 transition-all flex items-center justify-center bg-slate-950">
                  <input
                    type="color"
                    value={member.customEmbedColor && /^#[0-9A-Fa-f]{6}$/.test(member.customEmbedColor) ? member.customEmbedColor : '#10b981'}
                    onChange={(e) => onUpdateCustomSettings(member.name, { customEmbedColor: e.target.value })}
                    className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer opacity-100 scale-150" />
                  
                </div>
                {member.customEmbedColor &&
                <button
                  onClick={() => onUpdateCustomSettings(member.name, { customEmbedColor: '' })}
                  className="px-2.5 bg-red-950/40 hover:bg-red-950 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg text-[9px] font-bold uppercase transition-all"
                  title="Remover cor personalizada e voltar ao padrão">
                  
                    Resetar
                  </button>
                }
              </div>
            </div>

            {/* 3. Theme/Glow Color Select Box */}
            <div>
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                Cor do Brilho / Tema do Card
              </label>
              <select
                value={member.customGlowColor || 'default'}
                onChange={(e) => onUpdateCustomSettings(member.name, { customGlowColor: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                
                <option value="default" className="bg-slate-950 text-slate-400">Padrão</option>
                <option value="cosmic-purple" className="bg-slate-950 text-purple-400">Brilho Roxo Cósmico</option>
                <option value="hellfire" className="bg-slate-950 text-red-400">Brilho Magma Flame</option>
                <option value="divine-gold" className="bg-slate-950 text-amber-400">Brilho Ouro Divino</option>
                <option value="cyber-cyan" className="bg-slate-950 text-cyan-400">Brilho Neon Gelo</option>
                <option value="emerald-toxic" className="bg-slate-950 text-emerald-400">Brilho Tóxico</option>
              </select>
            </div>

            {/* 3b. Skin Select Box */}
            <div>
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                Skin / Placa Personalizada (Estilo do Container)
              </label>
              <select
                value={member.customCardSkin || 'none'}
                onChange={(e) => onUpdateCustomSettings(member.name, { customCardSkin: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                
                <option value="none" className="bg-slate-950 text-slate-400">Padrão (Sem Skin)</option>
                {SKIN_LIST.map((skin) =>
                <option key={skin.id} value={skin.id} className="bg-slate-950 text-slate-300">
                    Placa de {skin.name}
                  </option>
                )}
                {/* Older glow themes as fallback skins */}
                <option value="cosmic-purple" className="bg-slate-950 text-purple-400">Brilho Roxo Cósmico</option>
                <option value="hellfire" className="bg-slate-950 text-red-400">Brilho Magma Flame</option>
                <option value="divine-gold" className="bg-slate-950 text-amber-400">Brilho Ouro Divino</option>
                <option value="cyber-cyan" className="bg-slate-950 text-cyan-400">Brilho Neon Gelo</option>
                <option value="emerald-toxic" className="bg-slate-950 text-emerald-400">Brilho Tóxico</option>
              </select>
            </div>

            {/* 3x. Decoração de Iluminação da Foto de Perfil */}
            <div>
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                Iluminação / Decoração da Foto de Perfil
              </label>
              <select
                value={member.avatarGlow || 'none'}
                onChange={(e) => onUpdateCustomSettings(member.name, { avatarGlow: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                
                <option value="none" className="bg-slate-950 text-slate-400">Padrão (Sem Decoração)</option>
                <option value="hellfire-pulse" className="bg-slate-950 text-red-400 font-bold">🔥 Pulso de Fogo (Hellfire)</option>
                <option value="cyber-neon" className="bg-slate-950 text-cyan-400 font-bold">⚡ Neon Gelo (Cyber)</option>
                <option value="cosmic-nebula" className="bg-slate-950 text-purple-400 font-bold">🌌 Nebulosa Cósmica (Roxo)</option>
                <option value="divine-gold" className="bg-slate-950 text-yellow-400 font-bold">✨ Ouro Divino (Brilho)</option>
                <option value="toxic-acid" className="bg-slate-950 text-lime-400 font-bold">☣️ Ácido Tóxico (Verde)</option>
                <option value="vampiric-blood" className="bg-slate-950 text-rose-500 font-bold">🩸 Sangue Vampírico</option>
                <option value="rainbow-chroma" className="bg-slate-950 text-indigo-400 font-extrabold">🌈 RGB Arco-Íris Giratório</option>
                <option value="angelic-halo" className="bg-slate-950 text-amber-300 font-bold">👼 Halo Angelical Celestial</option>
                <option value="shield-barrier" className="bg-slate-950 text-indigo-400 font-bold">🛡️ Barreira de Escudo Girável</option>
              </select>
            </div>

            {/* 3c. Title Badge Skin/Color Select Box */}
            <div className="col-span-1 sm:col-span-2">
              <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
                Placa do Título / Cargo (Cor e Estilo)
              </label>
              <select
                value={member.customBadgeColor || 'default'}
                onChange={(e) => onUpdateCustomSettings(member.name, { customBadgeColor: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                
                <option value="default" className="bg-slate-950 text-slate-400">Padrão (Seguir cor do brilho ou Cinza)</option>
                <optgroup label="Brilhos de Tema" className="bg-slate-950 text-purple-400 font-bold">
                  <option value="cosmic-purple" className="text-purple-400">Brilho Roxo Cósmico</option>
                  <option value="hellfire" className="text-red-400">Brilho Magma Flame</option>
                  <option value="divine-gold" className="text-amber-400">Brilho Ouro Divino</option>
                  <option value="cyber-cyan" className="text-cyan-400">Brilho Neon Gelo</option>
                  <option value="emerald-toxic" className="text-emerald-400">Brilho Tóxico</option>
                </optgroup>
                <optgroup label="Placas Customizadas" className="bg-slate-950 text-slate-300 font-bold">
                  {SKIN_LIST.map((skin) =>
                  <option key={skin.id} value={skin.id} className="text-slate-300">
                      Placa de {skin.name}
                    </option>
                  )}
                </optgroup>
              </select>
            </div>

            {/* CONFIGURAÇÃO DE NOME DE EXIBIÇÃO */}
            <div className="col-span-1 sm:col-span-2 border-t border-purple-900/20 pt-3">
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block mb-2">
                ✍️ Nome de Exibição & Estilos
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Texto do Nome
                  </label>
                  <input
                    type="text"
                    value={member.customName || ''}
                    onChange={(e) => onUpdateCustomSettings(member.name, { customName: e.target.value })}
                    placeholder={member.name}
                    className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                  
                </div>
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Fonte do Nome
                  </label>
                  <select
                    value={member.nameFont || 'sans'}
                    onChange={(e) => onUpdateCustomSettings(member.name, { nameFont: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                    
                    <option value="sans">Inter (Padrão)</option>
                    <option value="mono">JetBrains Mono</option>
                    <option value="orbitron">Orbitron (Tech)</option>
                    <option value="marker">Marker (Escrito)</option>
                    <option value="cinzel">Cinzel (Épico)</option>
                    <option value="playfair">Playfair (Elegante)</option>
                    <option value="outfit">Outfit (Moderno)</option>
                    <option value="creepster">Creepster (Horror)</option>
                    <option value="retro">Press Start (Pixel)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Gradiente do Nome
                  </label>
                  <select
                    value={member.nameGradient || 'default'}
                    onChange={(e) => onUpdateCustomSettings(member.name, { nameGradient: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                    
                    <option value="default">Branco (Padrão)</option>
                    <option value="sunset-fire">Sunset Fire (Laranja/Vermelho)</option>
                    <option value="nebula-aurora">Nebula Aurora (Fúcsia/Roxo/Ciano)</option>
                    <option value="acid-green">Acid Green (Lima/Verde)</option>
                    <option value="royal-gold">Royal Gold (Ouro Nobre)</option>
                    <option value="electric-cyan">Electric Cyan (Ciano Elétrico)</option>
                    <option value="vampire-gaze">Vampire Gaze (Vampiro Sangue)</option>
                    <option value="chrome-metallic">Chrome Metallic (Prata Metálico)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CONFIGURAÇÃO DO PLACAR DE MORTES */}
            <div className="col-span-1 sm:col-span-2 border-t border-purple-900/20 pt-3">
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block mb-2">
                🛡️ Estilo do Placar / Contador
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Rótulo / Texto
                  </label>
                  <input
                    type="text"
                    value={member.deathsLabel || ''}
                    onChange={(e) => onUpdateCustomSettings(member.name, { deathsLabel: e.target.value })}
                    placeholder="MORTES"
                    className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all" />
                  
                </div>
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Ícone do Placar
                  </label>
                  <select
                    value={member.deathsIcon || 'skull'}
                    onChange={(e) => onUpdateCustomSettings(member.name, { deathsIcon: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                    
                    <option value="skull">Caveira (Padrão)</option>
                    <option value="ghost">Fantasma</option>
                    <option value="heart">Coração</option>
                    <option value="flame">Fogo</option>
                    <option value="sword">Espada</option>
                    <option value="shield">Escudo</option>
                    <option value="star">Estrela</option>
                    <option value="crown">Coroa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Fonte do Placar
                  </label>
                  <select
                    value={member.deathsFont || 'sans'}
                    onChange={(e) => onUpdateCustomSettings(member.name, { deathsFont: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                    
                    <option value="sans">Inter (Padrão)</option>
                    <option value="mono">JetBrains Mono</option>
                    <option value="orbitron">Orbitron (Tech)</option>
                    <option value="marker">Marker (Escrito)</option>
                    <option value="cinzel">Cinzel (Épico)</option>
                    <option value="playfair">Playfair (Elegante)</option>
                    <option value="outfit">Outfit (Moderno)</option>
                    <option value="creepster">Creepster (Horror)</option>
                    <option value="retro">Press Start (Pixel)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Gradiente/Estilo
                  </label>
                  <select
                    value={member.deathsGradient || 'crimson-hellfire'}
                    onChange={(e) => onUpdateCustomSettings(member.name, { deathsGradient: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                    
                    <option value="crimson-hellfire">Crimson Hellfire (Vermelho)</option>
                    <option value="cosmic-violet">Cosmic Violet (Roxo)</option>
                    <option value="toxic-acid">Toxic Acid (Lime)</option>
                    <option value="gold-royal">Gold Royal (Dourado)</option>
                    <option value="cyber-blue">Cyber Blue (Ciano)</option>
                    <option value="vampiric-blood">Vampiric Blood (Rosa Crimson)</option>
                    <option value="obsidian-shadow">Obsidian Shadow (Escuro)</option>
                    <option value="prism-rainbow">Prism Rainbow (Arco-Íris)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Botões de Edição
                  </label>
                  <select
                    value={member.deathsButtonsStyle || 'hover'}
                    onChange={(e) => onUpdateCustomSettings(member.name, { deathsButtonsStyle: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 hover:border-purple-500/30 focus:border-purple-500/60 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none transition-all cursor-pointer">
                    
                    <option value="hover">Mostrar ao Passar Mouse (Padrão)</option>
                    <option value="visible">Sempre Visível</option>
                    <option value="hidden">Ocultar Sempre (Somente Painel)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Danger: Remove Card */}
            <div className="col-span-1 sm:col-span-2 border-t border-purple-900/20 pt-3 flex justify-between items-center">
              <button
                onClick={() => {
                  if (confirm(`Tem certeza que deseja redefinir todas as configurações de ${member.name} para o padrão?`)) {
                    onUpdateCustomSettings(member.name, { customAvatarUrl: '', customBgUrl: '', customEmbedThumbnail: '', customEmbedBanner: '', customEmbedColor: '', avatarGlow: 'none' });
                  }
                }}
                className="px-3 py-1.5 bg-amber-600/15 hover:bg-amber-600 border border-amber-500/20 hover:border-transparent text-amber-400 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-md active:scale-95">
                
                Resetar Imagens
              </button>
              <button
                onClick={() => {
                  if (confirm(`Tem certeza que deseja remover o card de ${member.name} permanentemente?`)) {
                    if (onRemoveMember) {
                      onRemoveMember(member.name);
                    }
                  }
                }}
                className="px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 border border-rose-500/20 hover:border-transparent text-rose-400 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-md active:scale-95">
                
                Remover Card do Painel
              </button>
            </div>
          </div>
        </motion.div>
        }
    </AnimatePresence>
  </div>);

}

const getBadgeStyle = (item: ItemData, rarity: any) => {
  const color = item.customBorderColor || (rarity && rarity.id !== 'comum' ? rarity.color : undefined);
  if (!color) return {};

  const baseStyle: React.CSSProperties = {
    borderColor: color
  };

  const styleType = item.borderStyle || 'default';

  if (styleType === 'thick') {
    baseStyle.borderWidth = '2.5px';
  } else if (styleType === 'double') {
    baseStyle.borderStyle = 'double';
    baseStyle.borderWidth = '4px';
  } else if (styleType === 'dashed') {
    baseStyle.borderStyle = 'dashed';
  } else if (styleType === 'neon') {
    baseStyle.borderWidth = '2px';
    baseStyle.boxShadow = `0 0 12px ${color}`;
  } else if (styleType === 'left_bar') {
    baseStyle.borderLeftWidth = '5px';
    baseStyle.borderLeftColor = color;
    baseStyle.borderTopColor = 'rgba(255,255,255,0.06)';
    baseStyle.borderRightColor = 'rgba(255,255,255,0.06)';
    baseStyle.borderBottomColor = 'rgba(255,255,255,0.06)';
  } else {
    // default
    baseStyle.boxShadow = `0 0 10px ${color}33`;
  }

  return baseStyle;
};

function Section({
  title,
  items,
  value,
  onChange,
  onAdd,
  onRemove,
  onUpdate,
  clearInput,
  isSyncing = false,
  showQuantity = false,
  showLevel = false,
  maxLevel = 3













}: {title: string;items: ItemData[];value: string;onChange: (e: any) => void;onAdd: (skinId: string, rarityId?: string, quantity?: string, level?: string, borderStyle?: string, customBorderColor?: string, ornament?: string) => void;onRemove: (id: string) => void;onUpdate: (id: string, data: Partial<ItemData>) => void;clearInput: () => void;isSyncing?: boolean;showQuantity?: boolean;showLevel?: boolean;maxLevel?: number;}) {
  const [selectedSkin, setSelectedSkin] = useState(SKIN_LIST[0].id);
  const [selectedRarity, setSelectedRarity] = useState<string>('comum');
  const [quantityInput, setQuantityInput] = useState<string>('1x');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedBorderStyle, setSelectedBorderStyle] = useState<string>('default');
  const [selectedBorderColor, setSelectedBorderColor] = useState<string>('');
  const [selectedOrnament, setSelectedOrnament] = useState<string>('');
  const [showPicker, setShowPicker] = useState(false);

  const levelOptions = [{ id: '', name: 'Sem Level' }];
  for (let i = 1; i < maxLevel; i++) {
    levelOptions.push({ id: String(i), name: `Lvl ${i}` });
  }
  levelOptions.push({ id: 'MAX', name: 'MAX' });

  // States for editing an existing item
  const [editingItem, setEditingItem] = useState<ItemData | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSkin, setEditSkin] = useState('');
  const [editRarity, setEditRarity] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editBorderStyle, setEditBorderStyle] = useState('default');
  const [editBorderColor, setEditBorderColor] = useState('');
  const [editOrnament, setEditOrnament] = useState('');

  const handleAddItem = () => {
    if (value.trim()) {
      onAdd(
        selectedSkin,
        selectedRarity,
        showQuantity ? quantityInput : undefined,
        showLevel ? selectedLevel : undefined,
        selectedBorderStyle,
        selectedBorderColor,
        selectedOrnament
      );
      clearInput();
      setShowPicker(false);
      if (showQuantity) {
        setQuantityInput('1x');
      }
      setSelectedLevel('');
      setSelectedBorderStyle('default');
      setSelectedBorderColor('');
      setSelectedOrnament('');
    }
  };

  const handleStartEdit = (item: ItemData) => {
    setEditingItem(item);
    setEditValue(item.text);
    setEditSkin(item.skinId);
    setEditRarity(item.rarityId || 'comum');
    setEditQuantity(item.quantity || '1x');
    setEditLevel(item.level || '');
    setEditBorderStyle(item.borderStyle || 'default');
    setEditBorderColor(item.customBorderColor || '');
    setEditOrnament(item.ornament || '');
  };

  const handleSaveEdit = () => {
    if (editingItem && editValue.trim()) {
      onUpdate(editingItem.id, {
        text: editValue,
        skinId: editSkin,
        rarityId: editRarity,
        quantity: showQuantity ? editQuantity : undefined,
        level: showLevel ? editLevel : undefined,
        borderStyle: editBorderStyle,
        customBorderColor: editBorderColor,
        ornament: editOrnament
      });
      setEditingItem(null);
    }
  };

  return (
    <section className="group/section">
      <div className="sub-section-header">
        <label>{title}</label>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="btn-add font-mono flex items-center gap-1.5">
          
          {showPicker ? <X size={10} /> : <Plus size={10} />}
          {showPicker ? 'Fechar' : '+ Adicionar'}
        </button>
      </div>
      
      <div className="flex flex-col gap-3">
        {showPicker && !isSyncing &&
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4 shadow-2xl">
          
            <div className="flex items-center gap-2">
              <input
              autoFocus
              className="input-bento h-9 text-[11px] flex-1"
              placeholder={`Adicionar ${title.toLowerCase()}...`}
              value={value}
              onChange={onChange}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()} />
            
              {showQuantity &&
            <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qtd:</span>
                  <input
                className="input-bento h-9 text-[11px] w-14 font-mono text-center"
                placeholder="Ex: 5x"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()} />
              
                </div>
            }
              <button
              onClick={handleAddItem}
              className="h-9 w-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20 shrink-0">
              
                <Plus size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-1 truncate">Escolha a Faixa (Raridade)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 p-1">
                {RARITY_LIST.map((rarity) =>
              <button
                key={rarity.id}
                onClick={() => setSelectedRarity(rarity.id)}
                className={`p-1.5 rounded-lg transition-all border text-[9px] font-bold uppercase truncate hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 ${
                selectedRarity === rarity.id ?
                'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-950 scale-100 opacity-100' : 'opacity-50'} ${
                rarity.bg} ${rarity.glow}`}>
                
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rarity.color }} />
                    {rarity.name}
                  </button>
              )}
              </div>
            </div>

            {showLevel &&
          <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-1 truncate">Escolha o Level (Máximo {maxLevel})</label>
                <div className={`grid ${maxLevel === 4 ? 'grid-cols-5' : 'grid-cols-4'} gap-2 p-1`}>
                  {levelOptions.map((lvl) =>
              <button
                key={lvl.id}
                type="button"
                onClick={() => setSelectedLevel(lvl.id)}
                className={`p-1.5 rounded-lg transition-all border text-[9px] font-bold uppercase truncate hover:scale-105 active:scale-95 flex items-center justify-center ${
                selectedLevel === lvl.id ?
                'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-950 scale-100 opacity-100 bg-indigo-950/40 border-indigo-500/50 text-indigo-300' : 'opacity-50 bg-slate-900 border-slate-800 text-slate-400'}`
                }>
                
                      {lvl.name}
                    </button>
              )}
                </div>
              </div>
          }

            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-1 truncate">Escolha a Skin/Placa Personalizada</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[120px] overflow-y-auto p-1 custom-scrollbar">
                {SKIN_LIST.map((skin) =>
              <button
                key={skin.id}
                onClick={() => setSelectedSkin(skin.id)}
                className={`p-2 rounded-lg transition-all border text-[9px] font-bold uppercase truncate hover:scale-105 active:scale-95 ${
                selectedSkin === skin.id ?
                'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-950 scale-100' : 'opacity-70'} ${
                skin.class}`}>
                
                    {skin.name}
                  </button>
              )}
              </div>
            </div>

            {/* Personalized Border style selector */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-1 truncate">Estilo da Borda da Placa</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-1">
                {[
              { id: 'default', name: 'Padrão' },
              { id: 'thick', name: 'Grossa' },
              { id: 'double', name: 'Dupla' },
              { id: 'dashed', name: 'Tracejada' },
              { id: 'neon', name: 'Néon Glow' },
              { id: 'left_bar', name: 'Lateral' }].
              map((st) =>
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedBorderStyle(st.id)}
                className={`p-1.5 rounded-lg transition-all border text-[9px] font-bold uppercase truncate hover:scale-105 active:scale-95 flex items-center justify-center ${
                selectedBorderStyle === st.id ?
                'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-950 bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-extrabold' : 'bg-slate-900 border-slate-800 text-slate-400'}`
                }>
                
                    {st.name}
                  </button>
              )}
              </div>
            </div>

            {/* Personalized Border color selector */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-1 truncate">Cor da Borda Personalizada</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-1">
                {[
              { id: '', name: 'Padrão', color: 'transparent' },
              { id: '#ef4444', name: 'Vermelho', color: '#ef4444' },
              { id: '#3b82f6', name: 'Azul', color: '#3b82f6' },
              { id: '#10b981', name: 'Verde', color: '#10b981' },
              { id: '#eab308', name: 'Amarelo', color: '#eab308' },
              { id: '#ec4899', name: 'Rosa', color: '#ec4899' },
              { id: '#a855f7', name: 'Roxo', color: '#a855f7' },
              { id: '#06b6d4', name: 'Ciano', color: '#06b6d4' },
              { id: '#f97316', name: 'Laranja', color: '#f97316' },
              { id: '#fbbf24', name: 'Ouro', color: '#fbbf24' }].
              map((c) =>
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedBorderColor(c.id)}
                className={`p-1.5 rounded-lg transition-all border text-[9px] font-bold uppercase truncate hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 ${
                selectedBorderColor === c.id ?
                'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-950 bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-extrabold' : 'bg-slate-900 border-slate-800 text-slate-400'}`
                }>
                
                    {c.id && <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: c.color }} />}
                    {c.name}
                  </button>
              )}
              </div>
            </div>

            {/* Personalized Ornament selector */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-1 truncate">Ornamento Especial (Efeitos Pro)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1">
                {[
              { id: '', name: 'Nenhum', icon: '❌' },
              { id: 'halo', name: 'Auréola Anjo', icon: '😇' },
              { id: 'menacing', name: 'Menacing (JoJo)', icon: 'ゴ' },
              { id: 'mahoraga', name: 'Roda Mahoraga', icon: '⚙️' },
              { id: 'demonlord', name: 'Aura Demon Lord', icon: '😈' },
              { id: 'sukuna', name: 'Cortes Sukuna', icon: '🔪' },
              { id: 'gojo', name: 'Infinito Gojo', icon: '🌌' },
              { id: 'susanoo', name: 'Susanoo Aura', icon: '🟣' },
              { id: 'sharingan', name: 'Olho Sharingan', icon: '🔴' },
              { id: 'amaterasu', name: 'Chamas Negras', icon: '🖤' },
              { id: 'fire', name: 'Fogo Infernal', icon: '🔥' },
              { id: 'wings', name: 'Asas de Anjo', icon: '🪽' },
              { id: 'lightning', name: 'Aura Raios', icon: '⚡' },
              { id: 'crown', name: 'Coroa Real', icon: '👑' },
              { id: 'demoneyes', name: 'Olhos Demônio', icon: '😈' },
              { id: 'web', name: 'Teia Sombria', icon: '🕸️' },
              { id: 'sparkles', name: 'Sparkles', icon: '✨' }].
              map((orn) =>
              <button
                key={orn.id}
                type="button"
                onClick={() => setSelectedOrnament(orn.id)}
                className={`p-1.5 rounded-lg transition-all border text-[9px] font-bold uppercase truncate hover:scale-105 active:scale-95 flex items-center justify-center gap-1 ${
                selectedOrnament === orn.id ?
                'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-950 bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-extrabold shadow-[0_0_8px_rgba(99,102,241,0.25)]' :
                'bg-slate-900 border-slate-800 text-slate-400'}`
                }>
                
                    <span>{orn.icon}</span>
                    <span className="truncate">{orn.name}</span>
                  </button>
              )}
              </div>
            </div>
          </motion.div>
        }
        
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ?
          <span className="text-[10px] font-mono text-slate-700 italic border border-dashed border-slate-900 py-1.5 px-3 rounded-lg w-full text-center">Nenhum registro...</span> :

          items.map((item) => {
            const skin = SKIN_LIST.find((s) => s.id === item.skinId);
            const rarity = RARITY_LIST.find((r) => r.id === item.rarityId);
            return (
              <motion.span
                key={item.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                className={`badge-item group/item cursor-default inline-flex items-center gap-1.5 pr-2 flex-nowrap whitespace-nowrap relative ${skin?.class || 'skin-default'}`}
                style={getBadgeStyle(item, rarity)}>
                
                  {/* Visual Ornaments / Efeitos Pro */}
                  {item.ornament === 'halo' &&
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none select-none z-20 flex justify-center w-full">
                      <span className="w-9 h-2 bg-transparent border-[1.5px] border-yellow-300 rounded-full shadow-[0_0_8px_#fde047,0_0_15px_#facc15] opacity-90 animate-pulse" style={{ transform: 'rotateX(65deg)' }} />
                    </div>
                }
                  {item.ornament === 'menacing' &&
                <div className="absolute inset-0 pointer-events-none select-none z-10 overflow-visible">
                      <span className="absolute -left-3 -top-2 text-[10px] font-black text-purple-400 font-sans tracking-tight animate-bounce drop-shadow-[0_0_3px_rgba(168,85,247,0.8)]">ゴ</span>
                      <span className="absolute -right-2 -top-3.5 text-[12px] font-black text-fuchsia-500 font-sans tracking-tight animate-pulse delay-75 drop-shadow-[0_0_4px_rgba(217,70,239,0.8)]">ゴ</span>
                      <span className="absolute -left-1.5 -bottom-3 text-[10px] font-black text-violet-400 font-sans tracking-tight animate-pulse duration-1000 drop-shadow-[0_0_3px_rgba(139,92,246,0.8)]">ゴ</span>
                      <span className="absolute -right-3 -bottom-2 text-[9px] font-black text-indigo-400 font-sans tracking-tight animate-bounce delay-150 drop-shadow-[0_0_3px_rgba(99,102,241,0.8)]">ゴ</span>
                    </div>
                }
                  {item.ornament === 'mahoraga' &&
                <div className="absolute -top-5 -right-3 pointer-events-none select-none z-0 animate-[spin_10s_linear_infinite] opacity-90 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="3" stroke="#f59e0b" strokeWidth="1.5" />
                        <circle cx="12" cy="12" r="1" fill="#f59e0b" />
                        <circle cx="12" cy="12" r="8" stroke="#f59e0b" strokeWidth="1.5" />
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) =>
                    <line
                      key={angle}
                      x1="12"
                      y1="12"
                      x2={12 + 8 * Math.cos(angle * Math.PI / 180)}
                      y2={12 + 8 * Math.sin(angle * Math.PI / 180)}
                      stroke="#f59e0b"
                      strokeWidth="1.2" />

                    )}
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) =>
                    <circle
                      key={`knob-${angle}`}
                      cx={12 + 8 * Math.cos(angle * Math.PI / 180)}
                      cy={12 + 8 * Math.sin(angle * Math.PI / 180)}
                      r="1.2"
                      fill="#fbbf24" />

                    )}
                      </svg>
                    </div>
                }
                  {item.ornament === 'demonlord' &&
                <div className="absolute inset-0 pointer-events-none select-none rounded-xl border border-red-600/50 animate-demonlord z-[-1]">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-950/40 via-black/30 to-red-950/40 rounded-xl blur-[2px]" />
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] drop-shadow-[0_0_4px_#ef4444] animate-bounce">😈</span>
                    </div>
                }
                  {item.ornament === 'sukuna' &&
                <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none select-none z-10">
                      <div className="absolute top-0 left-0 w-[150%] h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444] animate-sukuna-1" />
                      <div className="absolute top-0 right-0 w-[150%] h-[2px] bg-white shadow-[0_0_6px_#ffffff] animate-sukuna-2" />
                    </div>
                }
                  {item.ornament === 'gojo' &&
                <div className="absolute inset-0 pointer-events-none select-none rounded-xl border border-indigo-500/50 animate-gojo-infinity shadow-[0_0_15px_rgba(99,102,241,0.4)] z-[-1] overflow-visible">
                      <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full blur-[1px] shadow-[0_0_10px_#3b82f6] animate-pulse" />
                      <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-red-500 rounded-full blur-[1px] shadow-[0_0_10px_#ef4444] animate-pulse delay-300" />
                      <span className="absolute inset-0 bg-indigo-950/30 rounded-xl mix-blend-color-dodge animate-pulse" />
                    </div>
                }
                  {item.ornament === 'susanoo' &&
                <div className="absolute inset-x-0 -inset-y-2 pointer-events-none select-none z-[-2] flex justify-between px-1 overflow-visible animate-susanoo-flame">
                      <span className="text-[14px] font-bold text-fuchsia-500/80 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">💀</span>
                      <span className="text-[14px] font-bold text-fuchsia-500/80 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] scale-x-[-1]">💀</span>
                    </div>
                }
                  {item.ornament === 'sharingan' &&
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 border border-black flex items-center justify-center animate-sharingan shadow-[0_0_5px_#ef4444] z-20 pointer-events-none select-none">
                      <div className="relative w-full h-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-black" />
                        <div className="absolute w-2.5 h-2.5 rounded-full border border-black/40" />
                        <div className="absolute top-0.5 left-1.5 w-1 h-1 rounded-full bg-black" />
                        <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-black" />
                        <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-black" />
                      </div>
                    </div>
                }
                  {item.ornament === 'amaterasu' &&
                <div className="absolute inset-0 rounded-xl pointer-events-none select-none z-10 border border-black animate-amaterasu shadow-[inset_0_0_8px_#000,0_0_12px_#000]">
                      <span className="absolute -top-2 left-1/4 text-[8px]">🔥</span>
                      <span className="absolute -bottom-2 right-1/4 text-[8px] filter invert">🔥</span>
                    </div>
                }
                  {item.ornament === 'fire' &&
                <div className="absolute inset-0 bg-gradient-to-t from-red-600/25 via-orange-500/10 to-transparent opacity-75 rounded-xl blur-[1px] pointer-events-none select-none z-[-1] animate-pulse" />
                }
                  {item.ornament === 'wings' &&
                <div className="absolute inset-0 pointer-events-none select-none z-[-1]">
                      <span className="absolute right-full mr-[-4px] top-1/2 -translate-y-1/2 text-[13px] text-white/80 filter drop-shadow-[0_0_3px_rgba(255,255,255,0.5)] rotate-[12deg]">🪽</span>
                      <span className="absolute left-full ml-[-4px] top-1/2 -translate-y-1/2 text-[13px] text-white/80 filter drop-shadow-[0_0_3px_rgba(255,255,255,0.5)] scale-x-[-1] -rotate-[12deg]">🪽</span>
                    </div>
                }
                  {item.ornament === 'lightning' &&
                <div className="absolute inset-0 pointer-events-none select-none rounded-xl border border-cyan-400/30 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.25)] z-10">
                      <span className="absolute -top-1 left-1/3 w-1.5 h-1.5 bg-cyan-300 rounded-full animate-ping" />
                      <span className="absolute -bottom-1 right-1/4 w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping delay-300" />
                    </div>
                }
                  {item.ornament === 'crown' &&
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 pointer-events-none select-none z-20 text-[9px] filter drop-shadow-[0_1px_3px_rgba(251,191,36,0.6)] animate-bounce">
                      👑
                    </div>
                }
                  {item.ornament === 'demoneyes' &&
                <div className="absolute -top-2.5 -left-1 pointer-events-none select-none z-10 flex gap-0.5 animate-pulse text-[6px] text-red-500 drop-shadow-[0_0_2px_rgba(239,68,68,0.9)]">
                      👁️👁️
                    </div>
                }
                  {item.ornament === 'web' &&
                <span className="absolute -top-1.5 -left-1.5 text-[9px] text-slate-500/60 pointer-events-none select-none z-10">🕸️</span>
                }
                  {item.ornament === 'sparkles' &&
                <div className="absolute inset-0 pointer-events-none select-none z-10 overflow-visible">
                      <span className="absolute -top-2 -right-1 text-[7px] animate-spin text-amber-300">✨</span>
                      <span className="absolute -bottom-1 -left-1.5 text-[8px] animate-pulse text-indigo-300">✨</span>
                    </div>
                }

                  {rarity && rarity.id !== 'comum' &&
                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border tracking-wider leading-none shrink-0 whitespace-nowrap ${rarity.bg}`}>
                      {rarity.name}
                    </span>
                }
                  <span className="font-bold tracking-tight shrink-0 whitespace-nowrap">{item.text}</span>
                  {item.level &&
                <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border font-mono tracking-wider leading-none shrink-0 whitespace-nowrap ${
                item.level === 'MAX' || maxLevel === 3 && item.level === '3' || maxLevel === 4 && item.level === '4' ? 'bg-amber-950/60 border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]' : 'bg-slate-950/60 border-slate-800/40 text-slate-400'}`
                }>
                      {item.level === 'MAX' || maxLevel === 3 && item.level === '3' || maxLevel === 4 && item.level === '4' ? 'MAX' : `Lvl ${item.level}`}
                    </span>
                }
                  {showQuantity && item.quantity &&
                <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-slate-950/60 rounded border border-slate-800/40 text-indigo-400 font-mono tracking-wider leading-none shrink-0 whitespace-nowrap">
                      {item.quantity}
                    </span>
                }
                  
                  <div className="flex items-center gap-1.5 no-export ml-1.5 shrink-0">
                    <button
                    onClick={() => handleStartEdit(item)}
                    className="hover:scale-125 transition-all cursor-pointer opacity-40 hover:opacity-100 text-slate-300"
                    title="Editar">
                    
                      <Pencil size={10} />
                    </button>
                    <button
                    onClick={() => onRemove(item.id)}
                    className="hover:scale-125 transition-all cursor-pointer opacity-40 hover:opacity-100 text-slate-300"
                    title="Excluir">
                    
                      <X size={11} />
                    </button>
                  </div>
                </motion.span>);

          })
          }
        </div>
      </div>

      {/* Floating Backdrop-blurred Edit Modal */}
      <AnimatePresence>
        {editingItem &&
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-export">
            {/* Backdrop */}
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingItem(null)}
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />
          
            
            {/* Content Card */}
            <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 w-full max-w-md shadow-2xl relative z-10 space-y-5">
            
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Pencil size={13} className="text-indigo-400" />
                  Editar Registro — {title}
                </h4>
                <button
                onClick={() => setEditingItem(null)}
                className="text-slate-500 hover:text-white transition-colors">
                
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                {/* Text input */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Nome / Texto</label>
                  <input
                  autoFocus
                  className="input-bento h-10 text-xs w-full px-3"
                  placeholder={`Nome do registro...`}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} />
                
                </div>

                {/* Quantity Input if applicable */}
                {showQuantity &&
              <div className="space-y-1.5">
                    <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Quantidade / Detalhe</label>
                    <input
                  className="input-bento h-10 text-xs w-full px-3 font-mono"
                  placeholder="Ex: 5x, 10 un..."
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} />
                
                  </div>
              }

                {/* Rarity selector */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Escolha a Faixa (Raridade)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {RARITY_LIST.map((rarity) =>
                  <button
                    key={rarity.id}
                    type="button"
                    onClick={() => setEditRarity(rarity.id)}
                    className={`p-2 rounded-lg transition-all border text-[8px] font-bold uppercase truncate flex items-center justify-center gap-1.5 ${
                    editRarity === rarity.id ?
                    'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-900 scale-100 opacity-100' : 'opacity-50'} ${
                    rarity.bg} ${rarity.glow}`}>
                    
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rarity.color }} />
                        {rarity.name}
                      </button>
                  )}
                  </div>
                </div>

                {showLevel &&
              <div className="space-y-1.5">
                    <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Escolha o Level (Máximo {maxLevel})</label>
                    <div className={`grid ${maxLevel === 4 ? 'grid-cols-5' : 'grid-cols-4'} gap-2`}>
                      {levelOptions.map((lvl) =>
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setEditLevel(lvl.id)}
                    className={`p-2 rounded-lg transition-all border text-[8px] font-bold uppercase truncate flex items-center justify-center ${
                    editLevel === lvl.id ?
                    'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-900 scale-100 opacity-100 bg-indigo-950/40 border-indigo-500/50 text-indigo-300' : 'opacity-50 bg-slate-800 border-slate-700 text-slate-400'}`
                    }>
                    
                          {lvl.name}
                        </button>
                  )}
                    </div>
                  </div>
              }

                {/* Skin selector */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Escolha a Placa / Skin</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                    {SKIN_LIST.map((skin) =>
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => setEditSkin(skin.id)}
                    className={`p-2 rounded-lg transition-all border text-[8px] font-bold uppercase truncate ${
                    editSkin === skin.id ?
                    'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-900 scale-100' : 'opacity-70'} ${
                    skin.class}`}>
                    
                        {skin.name}
                      </button>
                  )}
                  </div>
                </div>

                {/* Border Style Selector */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Estilo da Borda da Placa</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                  { id: 'default', name: 'Padrão' },
                  { id: 'thick', name: 'Grossa' },
                  { id: 'double', name: 'Dupla' },
                  { id: 'dashed', name: 'Tracejada' },
                  { id: 'neon', name: 'Néon Glow' },
                  { id: 'left_bar', name: 'Lateral' }].
                  map((st) =>
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setEditBorderStyle(st.id)}
                    className={`p-2 rounded-lg transition-all border text-[8px] font-bold uppercase truncate flex items-center justify-center ${
                    editBorderStyle === st.id ?
                    'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-900 bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-extrabold' : 'bg-slate-850 border-slate-800 text-slate-400'}`
                    }>
                    
                        {st.name}
                      </button>
                  )}
                  </div>
                </div>

                {/* Custom Border Color Selector */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Cor da Borda Personalizada</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                  { id: '', name: 'Padrão', color: 'transparent' },
                  { id: '#ef4444', name: 'Vermelho', color: '#ef4444' },
                  { id: '#3b82f6', name: 'Azul', color: '#3b82f6' },
                  { id: '#10b981', name: 'Verde', color: '#10b981' },
                  { id: '#eab308', name: 'Amarelo', color: '#eab308' },
                  { id: '#ec4899', name: 'Rosa', color: '#ec4899' },
                  { id: '#a855f7', name: 'Roxo', color: '#a855f7' },
                  { id: '#06b6d4', name: 'Ciano', color: '#06b6d4' },
                  { id: '#f97316', name: 'Laranja', color: '#f97316' },
                  { id: '#fbbf24', name: 'Ouro', color: '#fbbf24' }].
                  map((c) =>
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setEditBorderColor(c.id)}
                    className={`p-2 rounded-lg transition-all border text-[8px] font-bold uppercase truncate flex items-center justify-center gap-1 ${
                    editBorderColor === c.id ?
                    'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-900 bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-extrabold' : 'bg-slate-850 border-slate-800 text-slate-400'}`
                    }>
                    
                        {c.id && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />}
                        {c.name}
                      </button>
                  )}
                  </div>
                </div>

                {/* Custom Ornament Selector */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">Ornamento Especial (Efeitos Pro)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                    {[
                  { id: '', name: 'Nenhum', icon: '❌' },
                  { id: 'halo', name: 'Auréola Anjo', icon: '😇' },
                  { id: 'menacing', name: 'Menacing (JoJo)', icon: 'ゴ' },
                  { id: 'mahoraga', name: 'Roda Mahoraga', icon: '⚙️' },
                  { id: 'demonlord', name: 'Aura Demon Lord', icon: '😈' },
                  { id: 'sukuna', name: 'Cortes Sukuna', icon: '🔪' },
                  { id: 'gojo', name: 'Infinito Gojo', icon: '🌌' },
                  { id: 'susanoo', name: 'Susanoo Aura', icon: '🟣' },
                  { id: 'sharingan', name: 'Olho Sharingan', icon: '🔴' },
                  { id: 'amaterasu', name: 'Chamas Negras', icon: '🖤' },
                  { id: 'fire', name: 'Fogo Infernal', icon: '🔥' },
                  { id: 'wings', name: 'Asas de Anjo', icon: '🪽' },
                  { id: 'lightning', name: 'Aura Raios', icon: '⚡' },
                  { id: 'crown', name: 'Coroa Real', icon: '👑' },
                  { id: 'demoneyes', name: 'Olhos Demônio', icon: '😈' },
                  { id: 'web', name: 'Teia Sombria', icon: '🕸️' },
                  { id: 'sparkles', name: 'Sparkles', icon: '✨' }].
                  map((orn) =>
                  <button
                    key={orn.id}
                    type="button"
                    onClick={() => setEditOrnament(orn.id)}
                    className={`p-2 rounded-lg transition-all border text-[8px] font-bold uppercase truncate flex items-center justify-center gap-1 ${
                    editOrnament === orn.id ?
                    'ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-900 bg-indigo-950/40 border-indigo-500/50 text-indigo-300 font-extrabold' : 'bg-slate-850 border-slate-800 text-slate-400'}`
                    }>
                    
                        <span>{orn.icon}</span>
                        <span className="truncate">{orn.name}</span>
                      </button>
                  )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-800/60">
                <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all">
                
                  Cancelar
                </button>
                <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20">
                
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>
    </section>);

}