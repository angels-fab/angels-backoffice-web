import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { ContentSection, PageContainer, PageHeader } from '@/components/ds'
import { QUICK_LINK_GROUPS } from '@/constants/links'
import { radius, typescale } from '@/theme/tokens'

export default function Links() {
  return (
    <PageContainer>
      <PageHeader icon={<LinkIcon />} title="바로가기" />
      {QUICK_LINK_GROUPS.map((g, gi) => (
        <ContentSection
          key={g.title}
          title={g.title}
          count={g.links.length}
          last={gi === QUICK_LINK_GROUPS.length - 1}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2 }}>
            {g.links.map((l) => (
              <Box
                key={l.url}
                component="a"
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={(t) => ({
                  position: 'relative', minWidth: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  p: '18px 10px 14px', textDecoration: 'none',
                  bgcolor: 'background.paper', border: `1px solid ${t.palette.divider}`, borderRadius: `${radius.card}px`,
                  transition: 'border-color .15s, background-color .15s',
                  '&:hover': { bgcolor: 'background.elevated', borderColor: alpha(t.palette.primary.main, 0.65) },
                  '&:hover .lk-ext': { opacity: 1 },
                })}
              >
                <OpenInNewIcon className="lk-ext" sx={{ position: 'absolute', top: 8, right: 8, fontSize: 14, color: 'primary.main', opacity: 0, transition: 'opacity .15s' }} />
                <Box
                  sx={{
                    height: 48, width: l.wide ? 92 : 48, px: '6px', boxSizing: 'border-box', flex: 'none',
                    bgcolor: 'common.white', borderRadius: `${radius.button}px`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {l.logo ? (
                    <Box component="img" src={l.logo} alt="" sx={{ maxWidth: '100%', maxHeight: '74%', objectFit: 'contain' }} />
                  ) : (
                    <Typography sx={{ fontSize: typescale.caption.size, fontWeight: 700, letterSpacing: '.4px', color: l.fallbackColor }}>
                      {l.fallbackText}
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: typescale.emphasis.size, fontWeight: typescale.cardTitle.weight, color: 'text.primary', textAlign: 'center', lineHeight: 1.35 }}>{l.name}</Typography>
                <Typography sx={{ fontSize: typescale.caption.size, color: 'text.disabled', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.host}</Typography>
              </Box>
            ))}
          </Box>
        </ContentSection>
      ))}
    </PageContainer>
  )
}
