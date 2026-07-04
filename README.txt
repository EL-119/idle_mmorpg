<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>황제의 길 - 방치형 MMORPG</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">IDLE WEB MMORPG</p>
        <h1>황제의 길</h1>
      </div>
      <button id="saveBtn" class="ghost-btn">저장</button>
    </header>

    <main class="game-grid">
      <section class="panel hero-panel">
        <div class="stage-badge" id="stageBadge">주민</div>
        <div class="character-card" id="characterCard">
          <div class="aura"></div>
          <div class="character" id="characterAvatar">民</div>
        </div>
        <h2 id="heroTitle">떠돌이 주민</h2>
        <p id="heroDesc">작은 마을에서 시작해 황제가 되는 길을 걷습니다.</p>

        <div class="bar-block">
          <div class="bar-label"><span>레벨</span><strong id="levelText">Lv. 1</strong></div>
          <div class="progress"><span id="expBar"></span></div>
          <div class="bar-label tiny"><span>EXP</span><strong id="expText">0 / 100</strong></div>
        </div>

        <div class="resource-row">
          <div><span>골드</span><strong id="goldText">0</strong></div>
          <div><span>전투력</span><strong id="powerText">10</strong></div>
          <div><span>스테이지</span><strong id="mapText">1</strong></div>
        </div>
      </section>

      <section class="panel battle-panel">
        <div class="panel-title">
          <h3>자동 사냥터</h3>
          <span id="battleState">전투 중</span>
        </div>
        <div class="monster-box">
          <div class="monster" id="monsterAvatar">슬라임</div>
          <div class="monster-info">
            <strong id="monsterName">들판 슬라임</strong>
            <div class="progress danger"><span id="monsterHpBar"></span></div>
            <p id="monsterHpText">HP 40 / 40</p>
          </div>
        </div>
        <div class="combat-log" id="combatLog"></div>
      </section>

      <section class="panel action-panel">
        <h3>성장 메뉴</h3>
        <button id="evolveBtn" class="primary-btn">승급하기</button>
        <button id="enhanceBtn" class="action-btn">무기 강화</button>
        <button id="bossBtn" class="action-btn">보스 도전</button>
        <button id="claimBtn" class="action-btn">접속 보상 받기</button>
        <button id="resetBtn" class="danger-btn">초기화</button>
      </section>

      <section class="panel info-panel">
        <h3>캐릭터 정보</h3>
        <ul class="stat-list">
          <li><span>진화 단계</span><strong id="evolutionText">1 / 6</strong></li>
          <li><span>무기 강화</span><strong id="weaponText">+0</strong></li>
          <li><span>초당 피해량</span><strong id="dpsText">10</strong></li>
          <li><span>승급 조건</span><strong id="evolveNeedText">Lv. 5 / 300G</strong></li>
        </ul>
      </section>
    </main>

    <nav class="bottom-nav">
      <button data-tab="hero" class="active">캐릭터</button>
      <button data-tab="battle">사냥</button>
      <button data-tab="growth">성장</button>
      <button data-tab="info">정보</button>
    </nav>
  </div>

  <div id="toast" class="toast"></div>
  <script src="script.js"></script>
</body>
</html>
