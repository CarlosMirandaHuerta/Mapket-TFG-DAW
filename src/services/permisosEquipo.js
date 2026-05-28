export const rolesGestionEquipo = ['admin', 'encargado']

export const puedeGestionarEquipo = (empleado) => {
  return rolesGestionEquipo.includes(empleado?.rol)
}
