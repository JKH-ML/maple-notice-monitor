const fs = require('fs').promises;
const path = require('path');

const API_BASE_URL = 'https://open.api.nexon.com/maplestory/v1';
const DATA_FILE = 'notice-data.json';

class MapleNoticeChecker {
  constructor() {
    this.apiKey = process.env.NEXON_API_KEY;
    this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    if (!this.apiKey) {
      throw new Error('NEXON_API_KEY environment variable is required');
    }
    
    if (!this.discordWebhookUrl) {
      throw new Error('DISCORD_WEBHOOK_URL environment variable is required');
    }
  }

  get headers() {
    return {
      'x-nxopen-api-key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  async fetchNotices() {
    try {
      const response = await fetch(`${API_BASE_URL}/notice`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching notices:', error);
      throw error;
    }
  }

  async loadPreviousData() {
    try {
      const data = await fs.readFile(DATA_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No previous data found, creating new file');
        return null;
      }
      throw error;
    }
  }

  async saveCurrentData(data) {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
      console.log('Data saved successfully');
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  }

  detectChanges(previousData, currentData) {
    if (!previousData) {
      // 첫 실행시에는 알림 없이 데이터만 저장
      return {
        hasChanges: false, // 알림 보내지 않음
        newNotices: currentData.notice || [],
        updatedNotices: [],
        type: 'initial'
      };
    }

    const changes = {
      hasChanges: false,
      newNotices: [],
      updatedNotices: [],
      type: 'update'
    };

    const previousNotices = previousData.notice || [];
    const currentNotices = currentData.notice || [];

    // 새로운 공지사항 찾기
    const previousIds = new Set(previousNotices.map(notice => notice.notice_id));
    changes.newNotices = currentNotices.filter(notice => !previousIds.has(notice.notice_id));

    // 업데이트된 공지사항 찾기 (제목이나 내용이 변경된 경우)
    const currentNoticeMap = new Map(currentNotices.map(notice => [notice.notice_id, notice]));
    
    for (const prevNotice of previousNotices) {
      const currentNotice = currentNoticeMap.get(prevNotice.notice_id);
      if (currentNotice && 
          (prevNotice.title !== currentNotice.title || 
           prevNotice.url !== currentNotice.url)) {
        changes.updatedNotices.push({
          previous: prevNotice,
          current: currentNotice
        });
      }
    }

    changes.hasChanges = changes.newNotices.length > 0 || changes.updatedNotices.length > 0;
    
    return changes;
  }

  formatDiscordMessage(changes) {
    const embeds = [];
    const timestamp = new Date().toISOString();

    // Discord 제한사항 헬퍼 함수들
    const truncateText = (text, maxLength) => {
      if (!text) return '';
      return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    };

    const validateUrl = (url) => {
      if (!url) return 'https://maplestory.nexon.com';
      try {
        new URL(url);
        return url;
      } catch {
        return 'https://maplestory.nexon.com';
      }
    };

    if (changes.type === 'initial') {
      embeds.push({
        title: truncateText('🍁 메이플스토리 공지사항 모니터링 시작', 256),
        description: truncateText(`현재 **${changes.newNotices.length}개**의 공지사항을 모니터링합니다.`, 4096),
        color: 0x00ff00,
        timestamp: timestamp
      });

      // 최근 3개만 표시하고 field 제한 준수
      const recentNotices = changes.newNotices.slice(0, 3);
      if (recentNotices.length > 0) {
        const fields = recentNotices.map(notice => ({
          name: truncateText(notice.title || '제목 없음', 256),
          value: truncateText(`[바로가기](${validateUrl(notice.url)})`, 1024),
          inline: false
        }));

        embeds.push({
          title: truncateText('📋 최근 공지사항', 256),
          fields: fields,
          color: 0x0099ff,
          timestamp: timestamp
        });
      }
    } else {
      if (changes.newNotices.length > 0) {
        // 새 공지사항도 최대 5개로 제한
        const limitedNewNotices = changes.newNotices.slice(0, 5);
        const fields = limitedNewNotices.map(notice => ({
          name: truncateText(notice.title || '제목 없음', 256),
          value: truncateText(
            `[바로가기](${validateUrl(notice.url)})\n📅 ${notice.date || '날짜 정보 없음'}`, 
            1024
          ),
          inline: false
        }));

        embeds.push({
          title: truncateText('🆕 새로운 공지사항', 256),
          description: truncateText(`**${changes.newNotices.length}개**의 새로운 공지사항이 등록되었습니다!`, 4096),
          fields: fields,
          color: 0xff6b35,
          timestamp: timestamp
        });
      }

      if (changes.updatedNotices.length > 0) {
        // 업데이트된 공지사항도 최대 5개로 제한
        const limitedUpdatedNotices = changes.updatedNotices.slice(0, 5);
        const fields = limitedUpdatedNotices.map(change => ({
          name: truncateText(change.current.title || '제목 없음', 256),
          value: truncateText(
            `[바로가기](${validateUrl(change.current.url)})\n📅 ${change.current.date || '날짜 정보 없음'}`, 
            1024
          ),
          inline: false
        }));

        embeds.push({
          title: truncateText('📝 업데이트된 공지사항', 256),
          description: truncateText(`**${changes.updatedNotices.length}개**의 공지사항이 업데이트되었습니다!`, 4096),
          fields: fields,
          color: 0xffa500,
          timestamp: timestamp
        });
      }
    }

    // Discord embeds 제한 (최대 10개)
    const limitedEmbeds = embeds.slice(0, 10);

    return {
      username: truncateText('MapleStory 공지봇', 80),
      avatar_url: 'https://ssl.nx.com/s2/game/maplestory/renewal/common/game_icon.png',
      embeds: limitedEmbeds
    };
  }

  async sendDiscordNotification(message) {
    try {
      // 메시지 유효성 검사
      if (!message || !message.embeds || message.embeds.length === 0) {
        throw new Error('Invalid message format: no embeds found');
      }

      // JSON 직렬화 테스트
      let jsonPayload;
      try {
        jsonPayload = JSON.stringify(message);
      } catch (jsonError) {
        throw new Error(`JSON serialization failed: ${jsonError.message}`);
      }

      // 메시지 크기 체크 (대략적)
      if (jsonPayload.length > 50000) {
        console.warn('Message might be too large, truncating embeds...');
        message.embeds = message.embeds.slice(0, 5);
        jsonPayload = JSON.stringify(message);
      }

      console.log('Sending Discord message:', JSON.stringify(message, null, 2));

      const response = await fetch(this.discordWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonPayload
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Discord API Error Response:', errorText);
        throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}\nResponse: ${errorText}`);
      }

      console.log('Discord notification sent successfully');
    } catch (error) {
      console.error('Error sending Discord notification:', error);
      
      // 간단한 fallback 메시지 시도
      try {
        const fallbackMessage = {
          content: `⚠️ 메이플스토리 공지사항 확인 중 알림 전송 오류가 발생했습니다.\n오류: ${error.message}`
        };
        
        const fallbackResponse = await fetch(this.discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackMessage)
        });

        if (fallbackResponse.ok) {
          console.log('Fallback message sent successfully');
        }
      } catch (fallbackError) {
        console.error('Fallback message also failed:', fallbackError);
      }
      
      throw error;
    }
  }

  async run() {
    try {
      console.log('🔍 Checking for MapleStory notice changes...');
      
      // 현재 공지사항 데이터 가져오기
      const currentData = await this.fetchNotices();
      console.log(`📋 Found ${currentData.notice?.length || 0} notices`);

      // 이전 데이터 로드
      const previousData = await this.loadPreviousData();

      // 변경사항 감지
      const changes = this.detectChanges(previousData, currentData);

      if (changes.hasChanges) {
        console.log('🚨 Changes detected!');
        console.log(`- New notices: ${changes.newNotices.length}`);
        console.log(`- Updated notices: ${changes.updatedNotices.length}`);

        // Discord 알림 발송
        const discordMessage = this.formatDiscordMessage(changes);
        await this.sendDiscordNotification(discordMessage);

        console.log('✅ Notification sent and data updated');
      } else {
        if (changes.type === 'initial') {
          console.log('📋 Initial data saved (no notification sent)');
        } else {
          console.log('✅ No changes detected');
        }
      }

      // 변경사항이 있거나 초기 실행인 경우 데이터 저장
      if (changes.hasChanges || changes.type === 'initial') {
        await this.saveCurrentData(currentData);
      }

    } catch (error) {
      console.error('❌ Error in notice checker:', error);
      
      // 오류 발생시 Discord에 알림
      try {
        const errorMessage = {
          username: 'MapleStory 공지봇',
          avatar_url: 'https://ssl.nx.com/s2/game/maplestory/renewal/common/game_icon.png',
          embeds: [{
            title: '⚠️ 공지사항 확인 중 오류 발생',
            description: `\`\`\`${error.message}\`\`\``,
            color: 0xff0000,
            timestamp: new Date().toISOString()
          }]
        };
        
        await this.sendDiscordNotification(errorMessage);
      } catch (webhookError) {
        console.error('Failed to send error notification:', webhookError);
      }
      
      process.exit(1);
    }
  }
}

// 모듈 export
module.exports = MapleNoticeChecker;

// 스크립트 실행
if (require.main === module) {
  const checker = new MapleNoticeChecker();
  checker.run();
}