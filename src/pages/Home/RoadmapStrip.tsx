import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { alpha } from '@mui/material/styles'
import { AppCard } from '@/components/ds'
import { ROADMAP_STEPS, type RoadmapStatus } from '@/constants/roadmap'
import { domain, radius, typescale, weight } from '@/theme/tokens'

/**
 * 홈 최상단 'FAB 구축 로드맵' 한 줄 판 (2026-08-06 사용자 지시).
 *
 * 종전에는 '현황' 접힘 줄 안에 있어 펼치지 않으면 안 보였다 — 항상 띄우되 높이를 줄인다.
 * 제목을 두 줄로 꺾어 **타임라인 왼쪽에 구분선을 사이에 두고** 세우면(사용자 아이디어)
 * 제목 줄 높이가 따로 들지 않아 카드가 얇아진다. 히어로 카드(RoadmapCard)의 그라데이션·
 * 펄스·배지는 다 뺐다 — 방문자 화면의 얼굴은 그대로 RoadmapCard 가 맡고, 이건 요약판이다.
 */

const NODE = 34

// 배경은 RoadmapCard 와 같은 불투명 면(var(--ink2)) — 반투명이면 뒤의 커넥터 선이 비쳐 보인다
const nodeStyle = (status: RoadmapStatus) => {
  if (status === 'done')
    return { border: domain.roadmap.done, color: domain.roadmap.done, bg: 'var(--ink2)', ring: `inset 0 0 0 48px ${alpha(domain.roadmap.done, 0.1)}` }
  if (status === 'current')
    return {
      border: domain.roadmap.current, color: 'common.white', bg: domain.roadmap.currentNodeBg,
      ring: `0 0 0 4px ${alpha(domain.roadmap.current, 0.16)}`,
    }
  return { border: 'var(--border)', color: domain.roadmap.planNodeText, bg: 'var(--ink2)', ring: 'none' }
}

export default function RoadmapStrip() {
  return (
    <AppCard padding={20}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
        {/* 제목 — 원래 쓰던 아이콘 타일을 제목 위에 두고 두 줄로 꺾어 세로 공간을 아낀다(사용자 지시) */}
        <Box sx={{ flexShrink: 0, pr: 2.5, borderRight: 1, borderColor: 'divider' }}>
          <Box
            sx={(t) => ({
              width: 34, height: 34, mb: 1, borderRadius: `${radius.card}px`,
              background: domain.roadmap.hero.tileBg[t.palette.mode],
              color: domain.roadmap.hero.tileIcon[t.palette.mode],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              '& svg': { fontSize: typescale.sectionTitle.size },
            })}
          >
            <TrendingUpIcon fontSize="inherit" />
          </Box>
          <Typography sx={{ fontSize: typescale.sectionTitle.size, fontWeight: typescale.sectionTitle.weight, lineHeight: 1.3 }}>
            FAB 구축
            <br />
            로드맵
          </Typography>
        </Box>

        {/* 타임라인 — 노드·이름·기간만. 좁으면 가로 스크롤 */}
        <Box sx={{ flex: 1, minWidth: 0, overflowX: 'auto', py: 0.5 }}>
          <Box sx={{ position: 'relative', minWidth: 620 }}>
            {/* 커넥터 — 노드 중심 높이 */}
            <Box
              sx={{
                position: 'absolute', left: '5%', right: '5%', top: NODE / 2 - 1, height: 2,
                borderRadius: `${radius.pill}px`,
                background: `linear-gradient(90deg,${domain.roadmap.done} 0%,${domain.roadmap.done} 48%,${domain.roadmap.current} 58%,var(--border) 70%,var(--border) 100%)`,
                opacity: 0.6,
              }}
            />
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'flex-start' }}>
              {ROADMAP_STEPS.map((step) => {
                const s = nodeStyle(step.status)
                const isCurrent = step.status === 'current'
                return (
                  <Box key={step.label} sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <Box sx={{ position: 'relative', width: NODE, height: NODE, zIndex: 1 }}>
                      {/* 진행중 펄스 링 — 히어로 카드와 같은 효과(반주기 어긋난 링 둘로 빈도 2배).
                          한 줄 판으로 줄이면서 빠뜨렸던 것을 되살린다(2026-08-06 사용자 지적) */}
                      {isCurrent && [0, -1.1].map((delay) => (
                        <Box
                          key={delay}
                          sx={{
                            position: 'absolute', top: 0, left: 0, width: NODE, height: NODE,
                            borderRadius: radius.circle,
                            border: `2px solid ${domain.roadmap.current}`,
                            animation: 'ringPulse 2.2s ease-out infinite',
                            animationDelay: `${delay}s`,
                            pointerEvents: 'none',
                          }}
                        />
                      ))}
                      <Box
                        sx={{
                          position: 'relative',
                          width: NODE, height: NODE, borderRadius: radius.circle,
                          border: `2px solid ${s.border}`, color: s.color,
                          background: s.bg, boxShadow: s.ring, /* design-lint-ok(shadow): 진행중 노드 강조 링 — 깊이 그림자가 아니다 */
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          '& svg': { fontSize: typescale.cardTitle.size },
                        }}
                      >
                        {step.icon}
                      </Box>
                    </Box>
                    <Typography
                      sx={{
                        mt: 0.75, fontSize: typescale.body.size,
                        fontWeight: isCurrent ? weight.bold : weight.semibold,
                        color: isCurrent ? 'text.primary' : 'text.secondary',
                        lineHeight: 1.25, textWrap: 'balance',
                      }}
                    >
                      {step.label}
                    </Typography>
                    <Typography sx={{ mt: 0.25, fontSize: typescale.caption.size, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
                      {step.period}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Box>
      </Box>
    </AppCard>
  )
}
