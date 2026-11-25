
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), '');

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

const rl = createInterface({ input: stdin, output: stdout });

try {
  const email = await rl.question('Email admin: ');
  const password = await rl.question('Password admin: ');

  const { error: loginError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (loginError) throw loginError;

  const catalog = JSON.parse(
    readFileSync('./public/catalog.json', 'utf8')
  );

  const { data: existing, error: fetchError } =
    await supabase.from('collections')
      .select('title,artist,category');

  if (fetchError) throw fetchError;

  const keys = new Set(
    existing.map(x =>
      JSON.stringify([x.title, x.artist, x.category])
    )
  );

  const rows = catalog
    .filter(x =>
      !keys.has(JSON.stringify([x.title, x.artist, x.category]))
    )
    .map(({ id, ...x }) => ({
      title: x.title,
      artist: x.artist || '',
      category: x.category,
      genre: x.genre || '',
      year: x.year || '',
      label: x.label || '',
      condition: x.condition || '',
      description: x.description || '',
      images: x.images || [],
      featured: x.featured ?? false
    }));

  console.log(`Koleksi yang akan dimigrasikan: ${rows.length}`);

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);

    const { error } = await supabase
      .from('collections')
      .insert(batch);

    if (error) throw error;

    console.log(`Berhasil menyimpan ${i + batch.length} koleksi`);
  }

  console.log('Migrasi katalog selesai!');
} catch (error) {
  console.error('Migrasi gagal:', error.message);
} finally {
  rl.close();
}
