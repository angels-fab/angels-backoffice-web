import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { alpha } from '@mui/material/styles'
import { ROADMAP_STEPS, type RoadmapStatus } from '@/constants/roadmap'
import { domain, radius, iconSize } from '@/theme/tokens'

/**
 * FAB 구축 로드맵 — Claude Design 시안 "FAB Construction Roadmap" 재현.
 * 가로 단일행 타임라인(완료/진행중/예정), 현재 단계 글로우 + 펄스 링.
 * 자체 다크 그라데이션 카드라 시안 색을 그대로 사용(앱도 다크).
 */

interface StatusStyle {
  badge: string
  badgeColor: string
  badgeBg: string
  nodeBorder: string
  nodeColor: string
  nodeBg: string
  nodeShadow: string
}

// 상태 대표색 정본 = tokens.domain.roadmap (P1-2 승격 — D3 승인 시 토큰 값만 교환).
// 카드 크롬(배경 그라데이션·보더 등)은 P3 홈 정렬에서 처리.
const STATUS: Record<RoadmapStatus, StatusStyle> = {
  done: {
    badge: '완료',
    badgeColor: domain.roadmap.done,
    badgeBg: alpha(domain.roadmap.done, 0.14),
    nodeBorder: domain.roadmap.done,
    nodeColor: domain.roadmap.done,
    nodeBg: '#13202a',
    nodeShadow: `inset 0 0 0 48px ${alpha(domain.roadmap.done, 0.1)}`,
  },
  current: {
    badge: '진행중',
    // D3 맞교환: 진행중=그린 — 크롬(배지·노드 그라데이션·링)도 그린 계열로 동조
    badgeColor: '#d2f2e4',
    badgeBg: alpha(domain.roadmap.current, 0.3),
    nodeBorder: domain.roadmap.current,
    nodeColor: 'common.white',
    nodeBg: 'linear-gradient(158deg,#43e0a6,#21b381)',
    nodeShadow: `0 0 0 6px ${alpha(domain.roadmap.current, 0.16)},0 8px 18px -4px ${alpha('#21b381', 0.55)}`,
  },
  plan: {
    badge: '예정',
    badgeColor: domain.roadmap.plan,
    badgeBg: 'rgba(148,163,184,.13)',
    nodeBorder: '#35465a',
    nodeColor: '#5d6f86',
    nodeBg: '#161f2b',
    nodeShadow: 'none',
  },
}

export interface RoadmapCardProps {
  /** 현재 단계 펄스 링 표시 (기본 true) */
  pulse?: boolean
  /** 헤더 우측 범례 표시 (기본 true) */
  showLegend?: boolean
}

function LegendDot({ color, ring, border }: { color: string; ring?: string; border?: string }) {
  return (
    <Box
      component="span"
      sx={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: color,
        boxShadow: ring,
        border,
        flex: 'none',
      }}
    />
  )
}

export default function RoadmapCard({ pulse = true, showLegend = true }: RoadmapCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)
  // 모바일 등 가로 스크롤 시, 마운트 때 '진행중' 단계를 가운데로 스크롤(안 그러면 화면 밖이라 안 보임).
  // 데스크톱은 전체가 다 보여 overflow가 없으므로 scrollLeft가 0으로 유지돼 무영향.
  useEffect(() => {
    const c = scrollRef.current, n = currentRef.current
    if (!c || !n) return
    const target = n.offsetLeft - (c.clientWidth - n.offsetWidth) / 2
    if (target > 1) c.scrollLeft = target
  }, [])
  return (
    <Box
      sx={{
        // 아래 섹션 카드들과 동일한 전체 너비(카드 바깥 경계선 기준 정렬) — 폭 제한은 상위 PageContainer가 담당
        width: '100%',
        background: 'linear-gradient(160deg,#141d2b,#0e151f)',
        border: '1px solid #243245',
        borderRadius: '22px',
        p: '26px 30px 24px',
        color: '#e2e8f0',
        boxSizing: 'border-box',
        boxShadow: '0 18px 44px -22px rgba(0,0,0,.55)',
      }}
    >
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', mb: '24px', flexWrap: 'wrap' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: `${radius.modal}px`,
            background: 'linear-gradient(155deg,#2a4a86,#1a2740)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7eb0ff',
            flex: '0 0 auto',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07)',
            '& svg': { fontSize: 24 },
          }}
        >
          <TrendingUpIcon fontSize="inherit" />
        </Box>
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <Box sx={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
            FAB 구축 로드맵
          </Box>
          <Box sx={{ fontSize: 13, color: '#94a3b8', mt: '4px' }}>
            GIST 첨단AI반도체팹센터 구축 단계별 진행 현황
          </Box>
        </Box>
        {showLegend && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '0 0 auto' }}>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 12, color: '#9fb0c4' }}>
              <LegendDot color={domain.roadmap.done} />
              완료
            </Box>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 12, color: '#9fb0c4' }}>
              <LegendDot color={domain.roadmap.current} ring={`0 0 0 3px ${alpha(domain.roadmap.current, 0.22)}`} />
              진행중
            </Box>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 12, color: '#9fb0c4' }}>
              <LegendDot color="#2a3645" border="1.5px solid #45566b" />
              예정
            </Box>
          </Box>
        )}
      </Box>

      {/* 타임라인 (overflow-x:auto는 overflow-y도 auto로 계산되므로, 펄스 링이 위로 안 잘리게 위쪽 패딩 확보) */}
      <Box ref={scrollRef} sx={{ overflowX: 'auto', p: '16px 4px 12px' }}>
        <Box sx={{ position: 'relative', minWidth: 780 }}>
          {/* 진행 커넥터 */}
          <Box
            sx={{
              position: 'absolute',
              left: '6%',
              right: '6%',
              top: 23,
              height: 3,
              borderRadius: '3px',
              background: `linear-gradient(90deg,${domain.roadmap.done} 0%,${domain.roadmap.done} 40%,${domain.roadmap.current} 50%,#3a4d63 60%,#2a3645 100%)`,
              opacity: 0.75,
              zIndex: 0,
            }}
          />
          {/* 단계 컬럼들 */}
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            {ROADMAP_STEPS.map((step) => {
              const s = STATUS[step.status]
              const isCurrent = step.status === 'current'
              return (
                <Box
                  key={step.label}
                  ref={isCurrent ? currentRef : undefined}
                  sx={{
                    flex: step.wide ? '1.2 1 0' : '1 1 0',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  {/* 노드 */}
                  <Box sx={{ position: 'relative', width: 48, height: 48 }}>
                    {/* 펄스 링 — 속도(2.2s)는 유지, 반주기 어긋난 링을 하나 더 둬 빈도 2배(1.1s마다) */}
                    {isCurrent &&
                      pulse &&
                      [0, -1.1].map((delay) => (
                        <Box
                          key={delay}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
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
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: `2px solid ${s.nodeBorder}`,
                        color: s.nodeColor,
                        background: s.nodeBg,
                        boxShadow: s.nodeShadow,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '& svg': { fontSize: iconSize.header },
                      }}
                    >
                      {step.icon}
                    </Box>
                  </Box>

                  {/* 상태 배지 */}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      fontSize: 11,
                      fontWeight: 700,
                      p: '3px 10px',
                      borderRadius: '999px',
                      letterSpacing: '0.2px',
                      mt: '13px',
                      color: s.badgeColor,
                      background: s.badgeBg,
                    }}
                  >
                    {s.badge}
                  </Box>

                  {/* 제목 */}
                  <Box
                    sx={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: isCurrent ? '#f8fafc' : '#eef3f9',
                      mt: '9px',
                      lineHeight: 1.3,
                      textWrap: 'balance',
                    }}
                  >
                    {step.label}
                  </Box>

                  {/* 기간 */}
                  <Box sx={{ fontSize: 12, color: '#8195a9', mt: '5px', fontVariantNumeric: 'tabular-nums' }}>
                    {step.period}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
