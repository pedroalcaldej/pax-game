import { AVAILABLE_NATION_COLORS, NATIONS } from '../../../shared/Constants.js';

const ROOM_TTL_SECONDS = 60 * 60 * 24 * 7;
const SLOT_COUNT = 4;
const ROOM_KEY = (code) => `pax:lobby:room:${code}`;
const CHAT_KEY = (code) => `pax:lobby:chat:${code}`;
const WAITING_KEY = 'pax:lobby:public:waiting';

const MUTATE_SCRIPT = `
local key, waitingKey, operation, payloadJson, ttl = KEYS[1], KEYS[2], ARGV[1], ARGV[2], tonumber(ARGV[3])
local payload = cjson.decode(payloadJson)
local raw = redis.call('GET', key)
if operation == 'create' then
  if raw then return cjson.encode({ok=false, error='Ese código ya existe.'}) end
  local room = payload.room
  redis.call('SET', key, cjson.encode(room), 'EX', ttl)
  if room.privada == false then redis.call('ZADD', waitingKey, room.creadaEn, payload.code) end
  return cjson.encode({ok=true, room=room})
end
if not raw then return cjson.encode({ok=false, error='La sala no existe.'}) end
local room = cjson.decode(raw)
local players = room.jugadores or {}
local function persist()
  redis.call('SET', key, cjson.encode(room), 'EX', ttl)
  if room.estado == 'esperando' and room.privada == false then
    redis.call('ZADD', waitingKey, room.creadaEn or 0, payload.code)
  else
    redis.call('ZREM', waitingKey, payload.code)
  end
end
local function countPlayers()
  local n=0; for i=1,4 do if players['slot_'..i] then n=n+1 end end; return n
end
local function colorAvailable(color, exceptSlot)
  for i=1,4 do local s='slot_'..i; local p=players[s]; if s ~= exceptSlot and p and p.color == color then return false end end
  return true
end
if operation == 'join' then
  if room.estado ~= 'esperando' and room.estado ~= 'en_juego' then return cjson.encode({ok=false,error='La sala ya no está abierta.'}) end
  for i=1,4 do local p=players['slot_'..i]; if p and p.id == payload.userId then p.conectado=true; persist(); return cjson.encode({ok=true,room=room}) end end
  local slot=nil
  if room.estado == 'en_juego' then
    for i=1,4 do local s='slot_'..i; if players[s] and players[s].tipo == 'bot' then slot=s; break end end
  end
  if not slot then for i=1,4 do local s='slot_'..i; if not players[s] then slot=s; break end end end
  if not slot then return cjson.encode({ok=false,error='La sala está llena; no quedan países disponibles.'}) end
  local color=payload.defaultColor
  if not colorAvailable(color,nil) then color=nil end
  if not color then for _,c in ipairs(payload.colors) do if colorAvailable(c,nil) then color=c; break end end end
  players[slot]={id=payload.userId,nombre=payload.playerName,color=color,tipo='humano',listo=false,conectado=true}
  room.jugadores=players; persist(); return cjson.encode({ok=true,room=room})
elseif operation == 'profile' then
  if room.estado ~= 'esperando' then return cjson.encode({ok=false,error='El perfil solo se puede cambiar antes de iniciar.'}) end
  local validColor=false; for _,c in ipairs(payload.colors) do if c == payload.color then validColor=true end end
  if not validColor or string.len(payload.name) < 1 or string.len(payload.name) > 24 then return cjson.encode({ok=false,error='El nombre o el color no son válidos.'}) end
  for i=1,4 do local s='slot_'..i; local p=players[s]; if p and p.id == payload.userId then
    if not colorAvailable(payload.color,s) then return cjson.encode({ok=false,error='Ese color ya está ocupado.'}) end
    local changed=p.nombre ~= payload.name or p.color ~= payload.color
    p.nombre=payload.name; p.color=payload.color; if changed then p.listo=false end
    room.jugadores=players; persist(); return cjson.encode({ok=true,room=room})
  end end
  return cjson.encode({ok=false,error='No tienes un país reservado en esta sala.'})
elseif operation == 'ready' then
  if room.estado ~= 'esperando' then return cjson.encode({ok=false,error='La sala ya inició.'}) end
  local own=nil
  for i=1,4 do local p=players['slot_'..i]; if p and p.id == payload.userId then own=p; break end end
  if not own then return cjson.encode({ok=false,error='No tienes un país reservado en esta sala.'}) end
  own.listo=not own.listo
  local humans=0; local all=true
  for i=1,4 do local p=players['slot_'..i]; if p and p.tipo == 'humano' then humans=humans+1; if not p.listo then all=false end end end
  if humans > 0 and all then
    for i=1,4 do local s='slot_'..i; if not players[s] then
      local nation=payload.nations[i]; local color=nation.color
      if not colorAvailable(color,nil) then for _,c in ipairs(payload.colors) do if colorAvailable(c,nil) then color=c; break end end end
      players[s]={id='BOT_'..i,nombre=nation.name,color=color,tipo='bot',listo=true,conectado=true}
    end end
    room.estado='en_juego'; room.rondaActual=1
  end
  room.jugadores=players; persist(); return cjson.encode({ok=true,room=room})
elseif operation == 'replay' then
  if room.estado ~= 'en_juego' then return cjson.encode({ok=false,error='La sala ya no está disponible para otra partida.'}) end
  local keep={}; for i=1,4 do local s='slot_'..i; local p=players[s]; if p and p.tipo == 'humano' then p.listo=false; keep[s]=p end end
  room.jugadores=keep; room.estado='esperando'; room.rondaActual=1; persist(); return cjson.encode({ok=true,room=room})
elseif operation == 'leave' or operation == 'disconnect' then
  local slot=nil
  for i=1,4 do local s='slot_'..i; local p=players[s]; if p and p.id == payload.userId then slot=s; break end end
  if not slot then return cjson.encode({ok=true,room=room,removed=false}) end
  if operation == 'disconnect' then players[slot].conectado=false
  elseif room.creador == payload.userId then
    redis.call('DEL',key); redis.call('DEL',ARGV[4]); redis.call('ZREM',waitingKey,payload.code)
    return cjson.encode({ok=true,deleted=true,removed=true})
  else players[slot]=nil end
  room.jugadores=players
  if countPlayers() == 0 then
    redis.call('DEL',key); redis.call('DEL',ARGV[4]); redis.call('ZREM',waitingKey,payload.code)
    return cjson.encode({ok=true,deleted=true,removed=true})
  end
  persist(); return cjson.encode({ok=true,room=room,removed=true})
end
return cjson.encode({ok=false,error='Operación de sala desconocida.'})
`;

export class RedisLobbyStore {
  constructor(redis) { this.redis = redis; }

  async mutate(code, operation, payload = {}) {
    const result = await this.redis.eval(MUTATE_SCRIPT, {
      keys: [ROOM_KEY(code), WAITING_KEY],
      arguments: [operation, JSON.stringify({ ...payload, code }), String(ROOM_TTL_SECONDS), CHAT_KEY(code)]
    });
    return JSON.parse(result);
  }

  async create(userId, playerName, privada) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt=0; attempt<12; attempt+=1) {
      const code = `PAX${Array.from({length:3},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('')}`;
      const room = {
        creador: userId, privada, estado: 'esperando', rondaActual: 1, creadaEn: Date.now(),
        jugadores: { slot_1: { id:userId, nombre:playerName, color:AVAILABLE_NATION_COLORS[0], tipo:'humano', listo:false, conectado:true } }
      };
      const result = await this.mutate(code,'create',{ room });
      if (result.ok) return this.get(code);
    }
    throw new Error('No se pudo generar un código de sala disponible.');
  }

  async get(code) {
    const raw = await this.redis.get(ROOM_KEY(code));
    if (!raw) return null;
    const room = JSON.parse(raw);
    return { ...room, code, slots: Array.from({length:SLOT_COUNT},(_,i)=>room.jugadores?.[`slot_${i+1}`] || null) };
  }

  async join(code, userId, playerName) {
    const result = await this.mutate(code,'join',{ userId, playerName, defaultColor:AVAILABLE_NATION_COLORS[0], colors:AVAILABLE_NATION_COLORS });
    if (!result.ok) throw new Error(result.error);
    return this.get(code);
  }

  async quickMatch(userId, playerName) {
    const codes = await this.redis.zRange(WAITING_KEY, 0, -1);
    for (const code of codes) {
      try { return await this.join(code,userId,playerName); }
      catch (error) {
        if (!/llena|no existe|ya no está abierta/i.test(error.message)) throw error;
        if (/no existe/i.test(error.message)) await this.redis.zRem(WAITING_KEY, code);
      }
    }
    return this.create(userId,playerName,false);
  }

  async updateProfile(code,userId,name,color) {
    const result=await this.mutate(code,'profile',{userId,name,color,colors:AVAILABLE_NATION_COLORS}); if(!result.ok) throw new Error(result.error); return this.get(code);
  }
  async toggleReady(code,userId) {
    const result=await this.mutate(code,'ready',{userId,colors:AVAILABLE_NATION_COLORS,nations:NATIONS}); if(!result.ok) throw new Error(result.error); return this.get(code);
  }
  async replay(code) { const result=await this.mutate(code,'replay'); if(!result.ok) throw new Error(result.error); return this.get(code); }
  async leave(code,userId) { return this.mutate(code,'leave',{userId}); }
  async disconnect(code,userId) { return this.mutate(code,'disconnect',{userId}); }
  async addChat(code,message) {
    await this.redis.rPush(CHAT_KEY(code),JSON.stringify(message));
    await this.redis.lTrim(CHAT_KEY(code),-100,-1);
    await this.redis.expire(CHAT_KEY(code),ROOM_TTL_SECONDS);
  }
  async getChat(code) { return (await this.redis.lRange(CHAT_KEY(code),-100,-1)).map((item)=>JSON.parse(item)); }
}
