'use client'

import { useState } from 'react'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InterfacePreferences, NotificationPreferences } from '@/types'
import { User, Palette, Bell, Globe, Save } from 'lucide-react'

export function UserSettings() {
  const {
    profile,
    interfacePrefs,
    notificationPrefs,
    updateInterfacePreferences,
    updateNotificationPreferences,
    updateProfile
  } = useUserPreferences()

  const [localProfile, setLocalProfile] = useState({
    display_name: profile?.display_name || '',
    company_name: profile?.company_name || '',
    timezone: profile?.timezone || 'America/Montevideo'
  })

  const [saving, setSaving] = useState(false)

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
      </div>
    )
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await updateProfile(localProfile)
    } catch (error) {
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleInterfaceChange = (key: keyof InterfacePreferences, value: any) => {
    updateInterfacePreferences({ [key]: value })
  }

  const handleNotificationChange = (key: keyof NotificationPreferences, value: boolean) => {
    updateNotificationPreferences({ [key]: value })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-6 h-6 text-rose-600" />
        <h1 className="text-2xl font-bold text-gray-900">Configuración Personal</h1>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="interface" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Interfaz
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="regional" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Regional
          </TabsTrigger>
        </TabsList>

        {/* Perfil */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>
                Actualiza tu información personal y preferencias de cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="display_name">Nombre para mostrar</Label>
                  <Input
                    id="display_name"
                    value={localProfile.display_name}
                    onChange={(e) => setLocalProfile({ ...localProfile, display_name: e.target.value })}
                    placeholder="Tu nombre completo"
                  />
                </div>
                <div>
                  <Label htmlFor="company_name">Empresa</Label>
                  <Input
                    id="company_name"
                    value={localProfile.company_name}
                    onChange={(e) => setLocalProfile({ ...localProfile, company_name: e.target.value })}
                    placeholder="Nombre de tu empresa"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  El email no se puede cambiar desde aquí
                </p>
              </div>

              <Button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interfaz */}
        <TabsContent value="interface">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Apariencia</CardTitle>
                <CardDescription>Personaliza la apariencia de tu interfaz</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tema de color</Label>
                  <Select
                    value={interfacePrefs.theme}
                    onValueChange={(value) => handleInterfaceChange('theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pink">Rosa (Femenino)</SelectItem>
                      <SelectItem value="blue">Azul (Profesional)</SelectItem>
                      <SelectItem value="green">Verde (Natural)</SelectItem>
                      <SelectItem value="purple">Púrpura (Elegante)</SelectItem>
                      <SelectItem value="dark">Oscuro (Moderno)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Color de acento</Label>
                  <Select
                    value={interfacePrefs.accentColor}
                    onValueChange={(value) => handleInterfaceChange('accentColor', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rose">Rosa</SelectItem>
                      <SelectItem value="blue">Azul</SelectItem>
                      <SelectItem value="green">Verde</SelectItem>
                      <SelectItem value="purple">Púrpura</SelectItem>
                      <SelectItem value="orange">Naranja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="compactMode">Modo compacto</Label>
                  <Switch
                    id="compactMode"
                    checked={interfacePrefs.compactMode}
                    onCheckedChange={(checked) => handleInterfaceChange('compactMode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="showCountryFlags">Mostrar banderas de países</Label>
                  <Switch
                    id="showCountryFlags"
                    checked={interfacePrefs.showCountryFlags}
                    onCheckedChange={(checked) => handleInterfaceChange('showCountryFlags', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Diseño</CardTitle>
                <CardDescription>Configura el diseño de tu dashboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Layout del dashboard</Label>
                  <Select
                    value={interfacePrefs.dashboardLayout}
                    onValueChange={(value) => handleInterfaceChange('dashboardLayout', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid (Tarjetas)</SelectItem>
                      <SelectItem value="table">Tabla</SelectItem>
                      <SelectItem value="compact">Compacto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="sidebarCollapsed">Sidebar colapsado por defecto</Label>
                  <Switch
                    id="sidebarCollapsed"
                    checked={interfacePrefs.sidebarCollapsed}
                    onCheckedChange={(checked) => handleInterfaceChange('sidebarCollapsed', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notificaciones */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Preferencias de Notificaciones</CardTitle>
              <CardDescription>
                Configura cómo y cuándo quieres recibir notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailNotifications">Notificaciones por email</Label>
                    <p className="text-sm text-muted-foreground">Recibir notificaciones importantes por email</p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={notificationPrefs.emailNotifications}
                    onCheckedChange={(checked) => handleNotificationChange('emailNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="desktopNotifications">Notificaciones del navegador</Label>
                    <p className="text-sm text-muted-foreground">Mostrar notificaciones en el navegador</p>
                  </div>
                  <Switch
                    id="desktopNotifications"
                    checked={notificationPrefs.desktopNotifications}
                    onCheckedChange={(checked) => handleNotificationChange('desktopNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="priceChangeAlerts">Alertas de cambio de precios</Label>
                    <p className="text-sm text-muted-foreground">Notificar cuando cambien los precios de productos</p>
                  </div>
                  <Switch
                    id="priceChangeAlerts"
                    checked={notificationPrefs.priceChangeAlerts}
                    onCheckedChange={(checked) => handleNotificationChange('priceChangeAlerts', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="newProductAlerts">Alertas de nuevos productos</Label>
                    <p className="text-sm text-muted-foreground">Notificar cuando se agreguen nuevos productos</p>
                  </div>
                  <Switch
                    id="newProductAlerts"
                    checked={notificationPrefs.newProductAlerts}
                    onCheckedChange={(checked) => handleNotificationChange('newProductAlerts', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="weeklyReports">Reportes semanales</Label>
                    <p className="text-sm text-muted-foreground">Recibir resúmenes semanales por email</p>
                  </div>
                  <Switch
                    id="weeklyReports"
                    checked={notificationPrefs.weeklyReports}
                    onCheckedChange={(checked) => handleNotificationChange('weeklyReports', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regional */}
        <TabsContent value="regional">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Idioma y Región</CardTitle>
                <CardDescription>Configura el idioma y formato regional</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Idioma</Label>
                  <Select
                    value={interfacePrefs.language}
                    onValueChange={(value) => handleInterfaceChange('language', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Zona horaria</Label>
                  <Select
                    value={localProfile.timezone}
                    onValueChange={(value) => setLocalProfile({ ...localProfile, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Montevideo">Montevideo (GMT-3)</SelectItem>
                      <SelectItem value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                      <SelectItem value="America/Mexico_City">Ciudad de México (GMT-6)</SelectItem>
                      <SelectItem value="America/Santiago">Santiago (GMT-3)</SelectItem>
                      <SelectItem value="America/Caracas">Caracas (GMT-4)</SelectItem>
                      <SelectItem value="America/Bogota">Bogotá (GMT-5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Formato de Datos</CardTitle>
                <CardDescription>Configura cómo se muestran los números y fechas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Moneda por defecto</Label>
                  <Select
                    value={interfacePrefs.currency}
                    onValueChange={(value) => handleInterfaceChange('currency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                      <SelectItem value="UYU">UYU - Peso Uruguayo</SelectItem>
                      <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                      <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                      <SelectItem value="CLP">CLP - Peso Chileno</SelectItem>
                      <SelectItem value="VES">VES - Bolívar Venezolano</SelectItem>
                      <SelectItem value="COP">COP - Peso Colombiano</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Formato de fecha</Label>
                  <Select
                    value={interfacePrefs.dateFormat}
                    onValueChange={(value) => handleInterfaceChange('dateFormat', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (Europa/Latinoamérica)</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (Estados Unidos)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Formato de números</Label>
                  <Select
                    value={interfacePrefs.numberFormat}
                    onValueChange={(value) => handleInterfaceChange('numberFormat', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">1,234.56 (Estados Unidos)</SelectItem>
                      <SelectItem value="EU">1.234,56 (Europa)</SelectItem>
                      <SelectItem value="LA">1 234,56 (Latinoamérica)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}









