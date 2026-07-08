-- Seed public testimonials and transaction proof gallery.
-- Run after supabase/add_testimonials.sql.

delete from netflix.testimonial_gallery;
delete from netflix.testimonials;

insert into netflix.testimonials (name, is_anonymous, quote, rating, sort_order, is_active) values
  (
    'Acha',
    false,
    'Aku sewa profil Netflix buat maraton drakor weekend. Prosesnya cepet, profilnya langsung ready, dan nggak rebutan history tontonan orang lain.',
    5,
    1,
    true
  ),
  (
    null,
    true,
    'Awalnya takut akun sharing ribet, tapi ini dikasih arahan sampai login. PIN profil juga aman, jadi wishlist tontonan aku nggak kecampur.',
    5,
    2,
    true
  ),
  (
    'Lala',
    false,
    'Bayar, konfirmasi, langsung dikirim detail profilnya. Literally sat set banget buat yang pengen nonton malam itu juga.',
    5,
    3,
    true
  ),
  (
    'Mira',
    false,
    'Suka karena adminnya nggak judes. Aku nanya soal pindah device juga dijelasin pelan-pelan sampai bisa masuk Netflix lagi.',
    5,
    4,
    true
  ),
  (
    null,
    true,
    'Harga masuk akal buat profil Netflix private. Udah langganan beberapa kali dan sejauh ini aman terus.',
    5,
    5,
    true
  ),
  (
    'Vely',
    false,
    'Yang paling penting: responnya cepat pas profilku minta refresh. Nggak ditinggal setelah transfer, jadi tenang.',
    5,
    6,
    true
  );
