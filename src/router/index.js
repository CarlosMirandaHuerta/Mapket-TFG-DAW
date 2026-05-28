import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: {
        name: 'mapa-tienda',
        params: { codigoTienda: 'tienda-demo' },
        query: { from: 'entrada' },
      },
    },
    {
      path: '/s/:codigoTienda',
      name: 'mapa-tienda',
      component: () => import('@/views/ClienteMapaView.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminEntryView.vue'),
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/views/AdminLoginView.vue'),
    },
    {
      path: '/admin/setup-password',
      name: 'admin-setup-password',
      component: () => import('@/views/AdminSetupPasswordView.vue'),
    },
    {
      path: '/admin/reset-password',
      name: 'admin-reset-password',
      component: () => import('@/views/AdminResetPasswordView.vue'),
    },
    {
      path: '/admin/secciones',
      name: 'admin-secciones',
      component: () => import('@/views/AdminSeccionesView.vue'),
    },
    {
      path: '/admin/actividad',
      name: 'admin-actividad',
      component: () => import('@/views/AdminActividadView.vue'),
    },
    {
      path: '/admin/empleados',
      name: 'admin-empleados',
      component: () => import('@/views/AdminEmpleadosView.vue'),
    },
    {
      path: '/:rutaNoEncontrada(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const isAdminRoute = to.path.startsWith('/admin')

  if (!isAdminRoute || to.name === 'admin-login' || to.name === 'admin-reset-password') {
    return true
  }

  const { isSupabaseConfigured, supabase } = await import('@/lib/supabase')

  if (!isSupabaseConfigured || !supabase) {
    return true
  }

  const { getVerifiedSession } = await import('@/services/sesionAuth')
  const { isStale, session, user } = await getVerifiedSession()

  if (!session) {
    return {
      name: 'admin-login',
      query: {
        redirect: to.fullPath,
        reason: isStale ? 'session-expired' : undefined,
      },
    }
  }

  try {
    const { obtenerEmpleadoActual } = await import('@/services/datosTienda')
    const { puedeGestionarEquipo } = await import('@/services/permisosEquipo')
    const { empleado } = await obtenerEmpleadoActual({ completeOnboarding: false })

    if (empleado && to.name === 'admin-setup-password') {
      return {
        name: 'admin',
      }
    }

    if (empleado && to.name === 'admin-empleados' && !puedeGestionarEquipo(empleado)) {
      return {
        name: 'admin',
      }
    }

    if (empleado) {
      return true
    }

    if (user.app_metadata?.invitacion_empleado) {
      if (to.name === 'admin-setup-password') {
        return true
      }

      return {
        name: 'admin-setup-password',
      }
    }
  } catch {
    return {
      name: 'admin-login',
      query: {
        redirect: to.fullPath,
        reason: 'empleado-check-failed',
      },
    }
  }

  return {
    name: 'admin-login',
    query: {
      redirect: to.fullPath,
      reason: 'empleado-required',
    },
  }
})

export default router
