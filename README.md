# MyJapan — FULL Project Bundle v0.10.6

MyJapan adalah game city-builder 2.5D bergaya stylized 3D kartunis/hand-painted dengan tema sejarah Jepang dari Jōmon hingga Reiwa. Game berjalan di browser menggunakan Three.js dan Vite.

## Ringkasan inti untuk obrolan baru

- Baseline aktif: **game v0.10.6 / Project Memory 2.12.0**. Rilis ini merupakan patch perbaikan stabilitas dari source v0.10.5 yang tersedia, bukan lompatan ke versi roadmap yang belum memiliki source.
- Perbaikan: ResourceManager untuk geometri bangunan hasil clone/merge; cleanup pada upgrade/demolish/load/reset/Town Hall replacement; panel error startup yang terlihat; dan penghentian render minimap tersembunyi.
- Tes: **173 PASS, 0 FAIL, 3 SKIP / 176 total**. Tiga integrasi CityManager masih SKIP karena `three` belum dapat diunduh (`EAI_AGAIN`). 59/59 JS/ESM syntax PASS; CSS 1.118 nodes, 0 parse error; HTML 174 ID unik; memory JSON valid.
- Production build **BELUM TERUJI**: Vite belum terpasang dan registry npm tidak dapat di-resolve di lingkungan audit. `package-lock.json` tidak disertakan karena tidak dapat dihasilkan secara sah tanpa registry. Setelah upload, jalankan `npm install`, review/commit lockfile, lalu `npm ci`, `npm test`, dan `npm run build`.
- Browser/WebGL, visual desktop/tablet/mobile, dan FPS/memory perangkat nyata masih **NOT VERIFIED / NOT MEASURED**. Lihat `BUILD_PROFILE_STATUS.md`.
- Paket belum pernah di-commit ke repository menurut konfirmasi pengguna. ZIP ini disiapkan sebagai upload awal; tidak ada riwayat versi MyJapan lama yang perlu dihapus dari repository.

## v0.10.6 — Resource Lifecycle & Startup Reliability

- ResourceManager reference-counting and safe disposal for building-owned merged geometry.
- Cleanup integrated with building upgrade, demolition, Town Hall replacement, save load, and city reset. Shared cache/material/texture resources remain intact.
- Startup failures show an accessible alert panel with technical details and reload action.
- Hidden minimap canvas is no longer repainted during HUD updates.
- QA: 173 PASS / 0 FAIL / 3 SKIP / 176 total; build and browser runtime remain unverified because npm registry DNS blocked dependency installation.
- See `CHANGE_MANIFEST_v0.10.5.md`, `UPDATE_v0.10.5_UI_FLOW.md`, and `TEST_RESULTS_v0.10.6.tap`.

## v0.10.5 — Daimyo UI Flow & Clean Gameplay HUD

- Alur boot: layar hitam dengan emblem helm Daimyo fade-in 5 detik, menu utama, loading New Game, sweep sakura acak mengikuti vektor angin, lalu masuk ke kota. Reduced-motion tetap dihormati.
- HUD gameplay dibuat lebih bersih: brand MyJapan + era + kas/enam resource berikon; Settings dan kontrol percepatan (nonaktif) di kanan atas; dashboard populasi dengan placeholder kebahagiaan dan arsitek/builder yang belum aktif.
- Dock kiri bawah memakai ikon rumah Jepang untuk Build, di samping Stats, Achievement (nonaktif), dan Pengumuman (nonaktif). Build drawer memuat tujuh kategori berikon; Perdagangan, Fasilitas, dan Landmark ditandai NANTI dan tidak dapat dipilih.
- Tombol Bangun hanya muncul saat drawer Build terbuka dan nonaktif sampai pemain memilih kartu bangunan. Membuka Build tidak langsung menempatkan bangunan.
- Emblem Daimyo memulai tutorial dalam keadaan ringkas; tutorial dapat dibuka, berpindah ke posisi aman saat Build terbuka, lalu berganti menjadi gulungan Misi setelah Town Hall dibangun. Ikon misi membuka persyaratan era di Stats.
- Exit dari Settings menampilkan helm Daimyo, “Sampai jumpa lagi”, dan kanji “再会を願って”. Exit dari menu utama tetap memakai animasi amplop yang sudah ada.
- Fitur yang sengaja ditunda: Continue/Save, mode percepatan, kebahagiaan, jumlah arsitek/builder, perdagangan, fasilitas, landmark, achievement, dan announcement. Seluruhnya dicatat sebagai pengingat; tidak ada angka/fungsi palsu yang diaktifkan.
- `npm test`: **168 PASS, 0 FAIL, 3 SKIP / 171 total**. Tiga integrasi Three.js tetap SKIP karena dependency belum terpasang. Build Vite dan browser/WebGL masih harus diverifikasi pada Codespaces/Chrome; lihat `BUILD_PROFILE_STATUS.md`.

## v0.10.4 — UI Layout Cleanup

- Resource HUD desktop menampilkan ikon dan nilai pada satu baris agar lebih mudah dipindai; ponsel menggunakan susunan ringkas vertikal untuk menjaga enam resource tetap muat.
- Jarak badge era/tombol atas dan Shogun/pintasan pada layar kecil diperjelas. Kategori Build dan kartu bangunan menggunakan ukuran lebih konsisten dan tetap horizontal-scrollable.
- Kartu percakapan Shogun memiliki `pointer-events: auto`; shell companion tidak menangkap klik dunia.
- `node --test`: **164 PASS, 0 FAIL, 3 SKIP / 167 total** (3 tes integrasi memerlukan `three`). JavaScript syntax 57/57; CSS 0 parse error; HTML 164 ID unik.
- Build Vite BLOCKED (`vite: not found`); Chrome/WebGL, FPS dan frame-time nyata belum diverifikasi. QA build/profiling tetap prioritas P0.

## v0.10.0 — Horizontal Build Console, Samurai Guide & Terrain Polish

- Menu utama dalam game (Stats, Build, Pengaturan) disusun sebagai toolbar horizontal berbentuk kapsul glassmorphism di bagian bawah layar.
- Menekan Build membuka panel floating dengan rail kategori bundar/horizontal: Town Hall, Hunian, Infrastruktur, Pertanian & Industri, Perdagangan, Fasilitas, dan Landmark. Rail bisa digeser horizontal di layar sempit; daftar bangunan baru tampil setelah kategori dipilih.
- Membuka Build tidak otomatis memilih bangunan. Pemain tetap memilih kategori lalu kartu bangunan secara eksplisit sebelum masuk ke mode placement.
- Tutorial dipindahkan menjadi panel percakapan di sisi kanan. Emblem topeng samurai adalah SVG inline buatan proyek, dengan animasi idle ringan; panel bisa diringkas/dibuka dan tombol Petunjuk lain menampilkan tips interaktif.
- Pesan tutorial mengikuti empat tugas awal, target populasi 50 untuk Town Hall, lalu syarat perkembangan era.
- Animasi UI memakai opacity/transform, tanpa loop animasi JavaScript. `prefers-reduced-motion` mengurangi animasi. Blur glass dibatasi pada permukaan UI dan diturunkan untuk layar kecil.
- Terrain dipoles lagi: pigment noise deterministik untuk variasi warna yang lebih natural, moss tint, highlight punggung bukit, striasi halus pada lereng terbuka, dan kontur multi-level yang sedikit lebih rapat/terbaca. Mesh 192 subdivisi serta batching tetap dipertahankan.
- Gaya visual mengambil inspirasi umum dari city-builder 3D kartunis yang cerah dan berlapis, tetapi tidak menyalin aset, logo, peta, atau komposisi spesifik Clash of Clans. Identitas Jepang MyJapan tetap dipertahankan.

## Fitur yang tetap disertakan

- Main Menu kastil daimyo, welcome splash `Welcome to Japan / 日本へようこそ`, loading, efek angin sakura, surat perpisahan, dan kredit pembuat.
- New Game dimulai bersih; Build drawer tidak terbuka otomatis.
- Town Hall terbuka setelah 50 penduduk, hanya satu kali, dengan syarat tapak dan koneksi jalan.
- Hunian tunggal yang berevolusi arsitekturnya per era saat di-upgrade.
- Kamera isometrik 2.5D, drag/pan, zoom, klik untuk memilih/menempatkan, klik kanan/Escape untuk batal/tutup.
- HUD resource kanan atas dan dashboard Stats glassmorphism dengan grafik penduduk, kas, enam resource, logistik, transportasi, dan persyaratan era.
- Sistem pertanian, peternakan, hutan, tambang, gudang, ekonomi, populasi, transportasi, cuaca, musim, dan jam dunia.
- Ekstraktor dapat dibongkar untuk memulihkan slot produksi; pengembalian biaya mengikuti aturan di Project Memory.
- Save Game/Lanjutkan masih nonaktif; Exit ke Menu mengakhiri sesi yang belum disimpan.

## Menjalankan proyek

Memerlukan Node.js sesuai `engines` di `package.json`.

```bash
npm install
npm test
npm run check:files
npm run dev -- --host 0.0.0.0
```

Pada upload pertama, jalankan `npm install` agar npm membuat `package-lock.json`, lalu review dan commit file tersebut. Setelah lockfile tersedia, gunakan `npm ci` untuk instalasi bersih yang konsisten sebelum tes/build. ZIP ini tidak menyertakan lockfile karena registry npm tidak dapat diakses saat audit dan lockfile tidak boleh direkayasa.

Build produksi:

```bash
npm run build
```

Buka port `5173` melalui tab **Ports** bila menggunakan GitHub Codespaces.

## Upload awal ke repository

Pengguna mengonfirmasi belum pernah mengunggah versi MyJapan ke repository. Ekstrak ZIP ini, lalu unggah **isi folder `myjapan/`** ke root repository. Setelah commit, buka Codespaces/terminal repository dan jalankan langkah instalasi pada bagian Menjalankan proyek. ZIP tidak berisi `node_modules`, `dist`, cache, atau file sementara.
