import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import LinkIcon from '@mui/icons-material/Link'
import { PageContainer, PageHeader } from '@/components/ds'
import { QUICK_LINKS } from '@/constants/links'
import { radius, typescale } from '@/theme/tokens'

export default function Links() {
  return (
    <PageContainer>
      <PageHeader icon={<LinkIcon />} title="바로가기" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.75 }}>
        {QUICK_LINKS.map((l) => (
          <Box
            key={l.url}
            component="a"
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={(t) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25,
              p: '28px 12px 20px', textDecoration: 'none',
              bgcolor: 'background.paper', border: `1px solid ${t.palette.divider}`, borderRadius: `${radius.card}px`,
              transition: 'border-color .15s, background-color .15s',
              '&:hover': { bgcolor: 'background.elevated', borderColor: alpha(t.palette.primary.main, 0.65) },
            })}
          >
            <Box
              sx={{
                width: 64, height: 64, borderRadius: `${radius.modal}px`, background: l.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: typescale.display.size,
              }}
            >
              {l.icon}
            </Box>
            <Typography sx={{ fontSize: typescale.emphasis.size, fontWeight: typescale.cardTitle.weight, color: 'text.primary' }}>{l.name}</Typography>
            <Typography sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}>{l.host}</Typography>
          </Box>
        ))}
      </Box>
    </PageContainer>
  )
}
