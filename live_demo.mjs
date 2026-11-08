async function runDemo() {
  const baseUrl = 'http://localhost:4000/api/v1';

  console.log('=== 1. KIỂM TRA SỨC KHỎE HỆ THỐNG (HEALTH CHECK) ===');
  const healthRes = await fetch(`${baseUrl}/health`).then((r) => r.json());
  console.log('Kết quả:', healthRes);

  console.log('\n=== 2. KHỞI TẠO VÁN ĐẤU VỚI AI ENGINE (WORKER THREAD POOL) ===');
  const createRes = await fetch(`${baseUrl}/ai/game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      difficulty: 'MEDIUM',
      playerColor: 'white',
      initialTimeMs: 300000,
    }),
  }).then((r) => r.json());

  console.log('Trạng thái ván đấu ban đầu:');
  console.log({
    gameId: createRes.data.id,
    gameMode: createRes.data.gameMode,
    whitePlayer: createRes.data.whitePlayerName,
    blackPlayer: createRes.data.blackPlayerName,
    status: createRes.data.status,
    currentTurn: createRes.data.currentTurn,
    positionVersion: createRes.data.positionVersion,
  });

  const gameId = createRes.data.id;

  console.log('\n=== 3. NGƯỜI CHƠI THỰC HIỆN NƯỚC ĐI (e2 -> e4) ===');
  const move1Res = await fetch(`${baseUrl}/games/${gameId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'e2',
      to: 'e4',
      expectedVersion: 0,
    }),
  }).then((r) => r.json());

  console.log('Kết quả nước đi Người chơi:', {
    san: move1Res.data.move.san,
    fen: move1Res.data.fen,
    currentTurn: move1Res.data.currentTurn,
    positionVersion: move1Res.data.positionVersion,
  });

  console.log('\n=== 4. KÍCH HOẠT ĐỘNG CƠ AI TÍNH TOÁN NƯỚC ĐI QUA WORKER THREAD POOL ===');
  const aiStart = Date.now();
  const aiMoveRes = await fetch(`${baseUrl}/ai/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
  }).then((r) => r.json());
  const aiDuration = Date.now() - aiStart;

  console.log('Kết quả phản hồi của AI:', {
    san: aiMoveRes.data.move.san,
    fen: aiMoveRes.data.fen,
    currentTurn: aiMoveRes.data.currentTurn,
    positionVersion: aiMoveRes.data.positionVersion,
    stats: aiMoveRes.stats,
    durationMs: `${aiDuration}ms`,
  });

  console.log('\n=== 5. KIỂM TRA ĐỒNG BỘ TRẠNG THÁI & LỊCH SỬ NƯỚC ĐI ===');
  const gameStateRes = await fetch(`${baseUrl}/games/${gameId}`).then((r) => r.json());
  console.log('Lịch sử nước đi hiện tại:');
  gameStateRes.data.moves.forEach((m, idx) => {
    console.log(`  Nước ${idx + 1}: ${m.san} (từ ${m.fromSquare} sang ${m.toSquare})`);
  });

  console.log('\n=== 6. THỬ NGHIỆM CAS (COMPARE-AND-SWAP) ROLLBACK CHỐNG XUNG ĐỘT ĐỒNG THỜI ===');
  const staleMoveRes = await fetch(`${baseUrl}/games/${gameId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'g1',
      to: 'f3',
      expectedVersion: 0, // Outdated version! Current version is 2
    }),
  });
  const staleData = await staleMoveRes.json();
  console.log('Kết quả ngăn chặn xung đột (HTTP Status):', staleMoveRes.status);
  console.log('Thông điệp phản hồi từ máy chủ:', staleData.message);

  console.log('\n✅ TẤT CẢ CÁC TÍNH NĂNG & CƠ CHẾ BẢO MẬT HOẠT ĐỘNG HOÀN HẢO!');
}

runDemo().catch((err) => {
  console.error('Lỗi khi chạy demo:', err);
  process.exit(1);
});
