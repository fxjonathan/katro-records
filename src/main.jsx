import React,{useEffect,useMemo,useRef,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import{heicTo}from'heic-to';
import{Search,ArrowUpRight,Disc3,Menu,X,Lock,Plus,LogOut,Trash2,Edit3,Upload,ChevronLeft,Music2,Archive,Info}from'lucide-react';
import'./style.css';
const supabaseUrl=import.meta.env.VITE_SUPABASE_URL, supabaseKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
const db=supabaseUrl&&supabaseKey?createClient(supabaseUrl,supabaseKey):null;
const categories=['Semua','Vinyl','Kaset Pita','VCD Lagu','VCD Film'];
async function prepareImage(file){
  const isHeic=/\.(heic|heif)$/i.test(file.name)||['image/heic','image/heif','image/heic-sequence','image/heif-sequence'].includes(file.type);
  if(!isHeic)return file;
  let jpegBlob;
  try {
    jpegBlob=await heicTo({blob:file,type:'image/jpeg',quality:0.9});
  } catch (error) {
    console.error('HEIC conversion failed:',error);
    throw new Error(`HEIC tidak bisa dibaca oleh decoder. Coba file HEIC asli dari iPhone atau ekspor ulang sebagai JPEG. Detail: ${error?.message||'format tidak didukung'}`);
  }
  if(!(jpegBlob instanceof Blob)||jpegBlob.size===0)throw new Error('Konversi HEIC menghasilkan file kosong.');
  const baseName=file.name.replace(/\.(heic|heif)$/i,'');
  return new File([jpegBlob],`${baseName}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
}
function App(){const galleryRef=useRef(null);const[items,setItems]=useState([]),[loading,setLoading]=useState(true),[category,setCategory]=useState('Semua'),[query,setQuery]=useState(''),[selected,setSelected]=useState(null),[page,setPage]=useState('home'),[mobile,setMobile]=useState(false),[session,setSession]=useState(null),[adminItems,setAdminItems]=useState([]),[editing,setEditing]=useState(null),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[saveStep,setSaveStep]=useState(''),[photoOrder,setPhotoOrder]=useState([]),[dragIndex,setDragIndex]=useState(null);
const isAdmin=!!session;
async function load(){
  setLoading(true);

  if(db){
    const {data,error}=await db
      .from('collections')
      .select('*')
      .order('category')
      .order('title');

    if(!error){
      setItems(data || []);
    }else{
      console.error(error);
      await fallback();
    }
  }else{
    await fallback();
  }

  setLoading(false);
}

async function fallback(){
  const r=await fetch('/catalog.json');
  setItems(await r.json());
}
useEffect(()=>{load();if(db){db.auth.getSession().then(({data})=>setSession(data.session));const{data:{subscription}}=db.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()}},[]);
const filtered=useMemo(()=>items.filter(x=>(category==='Semua'||x.category===category)&&`${x.title} ${x.artist||''} ${x.genre||''}`.toLowerCase().includes(query.toLowerCase())),[items,category,query]);
const counts=useMemo(()=>Object.fromEntries(categories.slice(1).map(c=>[c,items.filter(x=>x.category===c).length])),[items]);
function go(p){setPage(p);setSelected(null);window.scrollTo(0,0);setMobile(false)}
async function login(e){e.preventDefault();if(!db){setNotice('Hubungkan Supabase terlebih dahulu. Lihat README.');return}const fd=new FormData(e.currentTarget);const{error}=await db.auth.signInWithPassword({email:fd.get('email'),password:fd.get('password')});setNotice(error?.message||'');}

async function saveItem(e) {
  e.preventDefault();
  if (!db) { setNotice('Hubungkan Supabase terlebih dahulu.'); return; }
  if (saving) return;
  setSaving(true); setNotice('');
  try {
    const fd = new FormData(e.currentTarget);
    const row = {
      title: fd.get('title'), artist: fd.get('artist'), category: fd.get('category'),
      genre: fd.get('genre'), year: fd.get('year'), label: fd.get('label'),
      condition: fd.get('condition'), description: fd.get('description'), images: []
    };
    // Urutan photoOrder adalah urutan final: foto lama dan foto baru.
    const ordered = photoOrder;
    row.images = [];
    let uploadIndex = 0;
    for (const [index, photo] of ordered.entries()) {
      if (photo.kind === 'existing') { row.images.push(photo.url); continue; }
      uploadIndex++;
      setSaveStep(`Mengonversi foto ${uploadIndex} dari ${ordered.filter(x=>x.kind==='new').length}...`);
      const file = await prepareImage(photo.file);
      setSaveStep(`Mengunggah foto ${uploadIndex} dari ${ordered.filter(x=>x.kind==='new').length}...`);
      const safeName = file.name.replace(/[^a-z0-9.]/gi, '-');
      const path = `${Date.now()}-${index}-${safeName}`;
      const { error: uploadError } = await db.storage.from('collection-images').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data } = db.storage.from('collection-images').getPublicUrl(path);
      row.images.push(data.publicUrl);
    }
    setSaveStep('Menyimpan data koleksi...');
    let result;
    if (editing?.id && typeof editing.id === 'number') {
      result = await db.from('collections').update(row).eq('id', editing.id).select('id');
      if (!result.error && (!result.data || result.data.length === 0)) throw new Error('Data tidak berubah. Baris koleksi tidak ditemukan atau akses update ditolak.');
    } else {
      result = await db.from('collections').insert(row).select('id');
    }
    if (result.error) throw result.error;
    const removedImages = (editing?.originalImages || []).filter(url => !row.images.includes(url));
    const removedPaths = removedImages.map(storagePathFromPublicUrl).filter(Boolean);
    if (removedPaths.length) {
      const { error: storageError } = await db.storage.from('collection-images').remove(removedPaths);
      if (storageError) console.warn('Data foto sudah diperbarui, tetapi file Storage belum terhapus:', storageError);
    }
    setSaveStep('Memuat ulang arsip...');
    await load();
    setEditing(null); setPhotoOrder([]); setNotice('Koleksi berhasil disimpan.');
  } catch (error) {
    console.error('Gagal menyimpan koleksi:', error);
    setNotice(`Gagal menyimpan: ${error?.message || 'Terjadi kesalahan.'}`);
  } finally { setSaving(false); setSaveStep(''); }
}
function movePhoto(from,to){
  if(from===null||from===to||to<0||to>=photoOrder.length)return;
  setPhotoOrder(current=>{const next=[...current];const [item]=next.splice(from,1);next.splice(to,0,item);return next;});
}
async function removeItem(id){if(!confirm('Hapus koleksi ini?'))return;const{error}=await db.from('collections').delete().eq('id',id);setNotice(error?.message||'Koleksi dihapus.');load()}
const imagesFor=x=>Array.isArray(x.images)?x.images.filter(Boolean):(x.images?[x.images]:[]);const imageFor=x=>imagesFor(x)[0]||'';
function storagePathFromPublicUrl(url){const marker='/storage/v1/object/public/collection-images/';const index=url.indexOf(marker);return index<0?null:decodeURIComponent(url.slice(index+marker.length));}
return <><header className="topbar"><button className="brand" onClick={()=>go('home')}><span className="brand-mark"><Disc3 size={25}/></span><span>KATRO <i>RECORDS</i><small>INDEPENDENT MUSIC ARCHIVE</small></span></button><nav><button onClick={()=>go('home')}>Beranda</button><button onClick={()=>go('archive')}>Arsip</button><button onClick={()=>go('about')}>Tentang</button></nav><div className="nav-right"><button className="admin-link" onClick={()=>go('admin')}><Lock size={14}/> Admin</button><button className="mobile-toggle" onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button></div></header>{mobile&&<div className="mobile-menu"><button onClick={()=>go('home')}>Beranda</button><button onClick={()=>go('archive')}>Arsip</button><button onClick={()=>go('about')}>Tentang</button><button onClick={()=>go('admin')}>Admin</button></div>}
{page==='home'&&<><section className="hero"><div className="hero-index"><span>INDEPENDENT RECORD STORE</span><span>JAKARTA / INDONESIA</span></div><div className="hero-copy"><div className="eyebrow"><span/> AN ARCHIVE OF PHYSICAL SOUND</div><h1>KEEP THE<br/><em>RECORD</em><br/>SPINNING<span className="period">.</span></h1><p>Kaset, piringan hitam, dan rilisan yang menyimpan cerita. Sebagian koleksi Katro Records, dicatat dan dirawat dalam satu arsip digital.</p><button className="primary" onClick={()=>go('archive')}>LIHAT ARSIP <ArrowUpRight size={17}/></button><div className="hero-foot">EST. ONLINE 2019 <span>／</span> STORE SINCE 2023</div></div><div className="hero-art"><div className="hero-record"><div className="record-label"><b>KATRO</b><small>SIDE A<br/>33⅓ RPM</small></div></div><div className="hero-sleeve">
  <div className="hero-sleeve-title">
    <b>KATRO</b>
    <i>RECORDS</i>
  </div>
  <small>SELECTED<br/>SOUNDS<br/>VOL. 01</small>
</div><div className="hero-caption">FIG. 01 — THE OBJECT IS PART OF THE SOUND</div></div><div className="hero-bottomline"><span>01 / 04 FORMATS</span><span>VINYL · CASSETTE · VCD</span><span>SCROLL TO EXPLORE ↓</span></div></section><section className="stats"><div><strong>{items.length||59}</strong><span>ITEM TERARSIP</span></div><div><strong>04</strong><span>KATEGORI MEDIA</span></div><div><strong>2019</strong><span>AWAL PERJALANAN</span></div><div className="stats-note">A growing archive of physical music and stories.</div></section><section className="editorial-pick"><div className="pick-heading"><span>FROM THE SHELVES / 001</span><b>OBJECTS WITH<br/>A PAST.</b><p>Setiap media punya bentuk, tekstur, dan cara dengarnya sendiri.</p><button className="text-link" onClick={()=>go('archive')}>BROWSE ALL OBJECTS <ArrowUpRight size={15}/></button></div><div className="pick-images">{items.slice(0,3).map((x,i)=><button key={x.id} className={'pick-item pick-'+i} onClick={()=>setSelected(x)}>{imageFor(x)&&<img src={imageFor(x)} loading="lazy"/>}<span>0{i+1} / {x.category}</span><b>{x.title}</b></button>)}</div></section><section className="section"><div className="section-head"><div><div className="eyebrow">BROWSE THE COLLECTION</div><h2>Explore the <em>formats.</em></h2></div><button className="text-link" onClick={()=>go('archive')}>Lihat semua arsip <ArrowUpRight size={16}/></button></div><div className="format-grid">{[{n:'01',t:'Vinyl',d:'Piringan hitam',c:counts.Vinyl||25},{n:'02',t:'Kaset Pita',d:'Magnetic tape',c:counts['Kaset Pita']||17},{n:'03',t:'VCD Lagu',d:'Music video collection',c:counts['VCD Lagu']||14},{n:'04',t:'VCD Film',d:'Film on disc',c:counts['VCD Film']||3}].map(a=><button className="format-card" key={a.t} onClick={()=>{setCategory(a.t);go('archive')}}><span>{a.n} / FORMAT</span><h3>{a.t}</h3><p>{a.d}</p><b>{a.c} <small>ITEM</small></b><ArrowUpRight className="format-arrow"/></button>)}</div></section><section className="quote-band"><span>“</span><p>Setiap rilisan punya cerita, setiap suara menyimpan ingatan.</p><small>— KATRO RECORDS</small></section></>}
{page==='archive'&&<section className="section archive-page"><div className="eyebrow">THE COLLECTION DATABASE</div><h1 className="page-title">Digital <em>Archive.</em></h1><p className="muted">Temukan rilisan fisik yang terdokumentasi di Katro Records.</p><div className="archive-tools"><div className="searchbox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari judul, artis, atau genre..."/></div><span>{filtered.length} koleksi ditemukan</span></div><div className="filters">{categories.map(c=><button className={category===c?'active':''} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div>{loading?<p>Memuat arsip...</p>:<div className="collection-grid">{filtered.map(x=><button className="collection-card" key={x.id} onClick={()=>setSelected(x)}><div className="cover">{imageFor(x)?<img src={imageFor(x)} loading="lazy"/>:<div className="no-cover"><Disc3 size={42}/><span>KATRO RECORDS</span></div>}<span className="format-tag">{x.category}</span></div><div className="card-info"><h3>{x.title}</h3><p>{x.artist||'Artis belum dicatat'}</p><small>{x.genre||'Genre belum dicatat'}</small></div></button>)}</div>}{filtered.length===0&&<div className="empty">Tidak ada koleksi yang cocok dengan pencarian.</div>}</section>}
{selected&&<div className="modal-back" onClick={()=>setSelected(null)}><div className="detail-modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}><X/></button><div className="detail-image">{imagesFor(selected).length?<><div className="detail-gallery-track" ref={galleryRef}>{imagesFor(selected).map((src,i)=><div className="detail-gallery-slide" key={`${src}-${i}`}><img src={src} alt={`${selected.title} - foto ${i+1}`}/><span>{String(i+1).padStart(2,'0')} / {String(imagesFor(selected).length).padStart(2,'0')}</span></div>)}</div>{imagesFor(selected).length>1&&<><button className="gallery-arrow gallery-prev" onClick={()=>galleryRef.current?.scrollBy({left:-galleryRef.current.clientWidth*.85,behavior:'smooth'})} aria-label="Foto sebelumnya"><ChevronLeft/></button><button className="gallery-arrow gallery-next" onClick={()=>galleryRef.current?.scrollBy({left:galleryRef.current.clientWidth*.85,behavior:'smooth'})} aria-label="Foto berikutnya"><ChevronLeft/></button></>}</>:<Disc3 size={80}/>}</div><div className="detail-copy"><div className="eyebrow">{selected.category} / COLLECTION RECORD</div><h2>{selected.title}</h2><h3>{selected.artist||'Artis belum dicatat'}</h3><p>{selected.description||'Belum ada deskripsi untuk koleksi ini.'}</p><dl>{[['Genre',selected.genre],['Tahun rilis',selected.year],['Label',selected.label],['Kondisi',selected.condition]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'Belum tersedia'}</dd></div>)}</dl><small className="muted">Metadata dapat dilengkapi melalui pengelola arsip.</small></div></div></div>}
{page==='about'&&<section className="section about-page"><div className="eyebrow">ABOUT THE RECORD STORE</div><h1 className="page-title">More than just<br/><em>a record store.</em></h1><div className="about-columns"><p>Katro Records berawal dari koleksi musik pribadi yang dikumpulkan oleh dua orang teman. Seiring bertambahnya koleksi, mereka mulai menjual rilisan secara online sekitar tahun 2019 melalui marketplace dan Instagram. Toko fisik Katro Records kemudian dibuka pada tahun 2023.</p><p>Arsip digital ini dibuat untuk mendokumentasikan sebagian koleksi fisik Katro Records, memperkenalkan rilisan kepada publik, serta membantu menjaga informasi tentang media musik fisik agar lebih mudah ditemukan.</p></div></section>}
{page==='admin'&&<section className="section admin-page"><div className="eyebrow">COLLECTION MANAGEMENT</div><h1 className="page-title">Archive <em>Admin.</em></h1>{!session?<form className="login-card" onSubmit={login}><Lock size={28}/><h2>Admin sign in</h2><p className="muted">Masuk untuk mengelola data koleksi Katro Records.</p><label>Email<input name="email" type="email" required placeholder="admin@email.com"/></label><label>Password<input name="password" type="password" required placeholder="Password"/></label><button className="primary">Masuk <ArrowUpRight size={16}/></button>{!db&&<p className="warning">Supabase belum dikonfigurasi. Ikuti langkah pada README untuk mengaktifkan admin.</p>}{notice&&<p className="notice">{notice}</p>}</form>:<><div className="admin-toolbar"><p>Login sebagai <b>{session.user.email}</b></p><div><button className="outline" onClick={()=>{setEditing({});setPhotoOrder([]);setNotice('');}}><Plus size={16}/> Tambah koleksi</button><button className="outline" onClick={()=>db.auth.signOut()}><LogOut size={16}/> Keluar</button></div></div>{notice&&<p className="notice admin-notice">{notice}</p>}{editing&&<form className="edit-form" onSubmit={saveItem}><h2>{editing.id?'Edit koleksi':'Tambah koleksi'}</h2><div className="form-grid"><label>Judul<input name="title" required defaultValue={editing.title}/></label><label>Artis<input name="artist" defaultValue={editing.artist}/></label><label>Kategori<select name="category" defaultValue={editing.category||'Vinyl'}>{categories.slice(1).map(c=><option>{c}</option>)}</select></label><label>Genre<input name="genre" defaultValue={editing.genre}/></label><label>Tahun rilis<input name="year" defaultValue={editing.year}/></label><label>Label<input name="label" defaultValue={editing.label}/></label><label>Kondisi<input name="condition" defaultValue={editing.condition}/></label><label>Foto koleksi (bisa pilih beberapa)<input name="photos" type="file" accept="image/*,.heic,.heif" multiple onChange={e=>{const chosen=Array.from(e.target.files||[]).filter(f=>f.size>0);setPhotoOrder(current=>[...current,...chosen.map((file,i)=>({kind:"new",file,preview:URL.createObjectURL(file),key:`new-${Date.now()}-${i}-${file.name}`}))]);e.target.value="";}}/><small className="muted">Pilih beberapa foto. Geser thumbnail di bawah untuk mengatur urutan; foto pertama menjadi cover.</small></label>{photoOrder.length>0&&<div className="wide existing-images"><span>Urutan foto — tarik thumbnail untuk mengubah posisi. Foto pertama menjadi cover.</span><div className="sortable-photos">{photoOrder.map((photo,index)=><figure key={photo.key} draggable={!saving} onDragStart={()=>setDragIndex(index)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();movePhoto(dragIndex,index);setDragIndex(null);}} onDragEnd={()=>setDragIndex(null)} className={dragIndex===index?'is-dragging':''}><img src={photo.kind==='existing'?photo.url:photo.preview} alt={`Foto koleksi ${index+1}`}/><small>{index===0?'COVER':`FOTO ${index+1}`}</small><button type="button" className="outline" disabled={saving} onClick={()=>setPhotoOrder(current=>current.filter((_,i)=>i!==index))}>Hapus foto</button></figure>)}</div></div>}<label className="wide">Deskripsi<textarea name="description" defaultValue={editing.description}/></label></div><div className="form-actions"><button type="button" className="outline" onClick={()=>{setEditing(null);setPhotoOrder([]);}}>Batal</button><button type="submit" className="primary" disabled={saving}>{saving?"Menyimpan...":"Simpan koleksi"}</button></div>{saving&&<div className="save-progress" role="status"><span className="save-spinner"/><div><b>{saveStep||"Sedang menyimpan..."}</b><small>Jangan tutup halaman sampai proses selesai.</small></div></div>}</form>}<div className="admin-list">{items.map(x=><div className="admin-row" key={x.id}><div className="admin-thumb">{imageFor(x)&&<img src={imageFor(x)}/>}</div><div><b>{x.title}</b><small>{x.category} · {x.artist||'Artis belum dicatat'}</small></div><button onClick={()=>{const imgs=imagesFor(x);setEditing({...x,images:imgs,originalImages:imgs});setPhotoOrder(imgs.map((url,i)=>({kind:'existing',url,key:`old-${x.id}-${i}`})));setNotice('');}}><Edit3 size={16}/></button><button onClick={()=>removeItem(x.id)}><Trash2 size={16}/></button></div>)}</div></>}</section>}
<footer><div className="footer-brand">KATRO <i>RECORDS</i></div><p>Preserving physical music, one record at a time.</p><span>© 2026 KATRO RECORDS DIGITAL ARCHIVE</span><button onClick={()=>go('admin')}><Lock size={13}/> Admin</button></footer></>}
createRoot(document.getElementById('root')).render(<App/>);
