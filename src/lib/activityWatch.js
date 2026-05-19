import { supabase } from './supabase';

export const syncActivityWatch = async (userId) => {
  try {
    const bucketsRes = await fetch('http://localhost:5601/api/0/buckets/?bypass_sw=1');
    const buckets = await bucketsRes.json();
    
    const payload = {
      window: null,
      afk: null,
      web: null
    };

    const windowBucket = Object.keys(buckets).find(key => key.includes('aw-watcher-window'));
    if (windowBucket) {
      const res = await fetch(`http://localhost:5601/api/0/buckets/${windowBucket}/events?limit=1&bypass_sw=1`);
      const events = await res.json();
      if (events[0]) payload.window = { app: events[0].data.app, title: events[0].data.title };
    }

    const afkBucket = Object.keys(buckets).find(key => key.includes('aw-watcher-afk'));
    if (afkBucket) {
      const res = await fetch(`http://localhost:5601/api/0/buckets/${afkBucket}/events?limit=1&bypass_sw=1`);
      const events = await res.json();
      if (events[0]) payload.afk = events[0].data.status;
    }

    const webBucket = Object.keys(buckets).find(key => key.includes('aw-watcher-web'));
    if (webBucket) {
      const res = await fetch(`http://localhost:5601/api/0/buckets/${webBucket}/events?limit=1&bypass_sw=1`);
      const events = await res.json();
      if (events[0]) payload.web = { url: events[0].data.url, title: events[0].data.title };
    }

    if (payload.window || payload.afk) {
      const { error } = await supabase.from('vanguard_footprint').insert({
        user_id: userId,
        category: 'activitywatch_v2',
        payload: payload,
        timestamp: new Date().toISOString()
      });
      
      if (error) throw error;
      return payload;
    }
  } catch (err) {
    console.error('❌ Błąd synchronizacji AW:', err.message);
    return null;
  }
};
