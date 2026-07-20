import React from 'react';
import { Calendar, Users, FileText, Settings, BarChart3, Shield, Activity, ChevronLeft, LogOut, UserCog, Stethoscope, Building2, BookOpen, UsersIcon, ClipboardList, Loader2, TrendingUp, CreditCard, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemConfig } from '@/hooks/useSystemConfig';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar = ({ activeSection, onSectionChange, isCollapsed, onToggleCollapse }: SidebarProps) => {
  const { signOut, user } = useAuth();
  const { data: systemConfig } = useSystemConfig();
  const { data: currentUser, isLoading: isLoadingUser, error: userError } = useCurrentUser();

  console.log('Auth user:', user);
  console.log('Current user data:', currentUser);
  console.log('User loading:', isLoadingUser);
  console.log('User error:', userError);

  const getMenuItems = () => {
    // Si hay error cargando usuario pero hay usuario autenticado, mostrar menú completo para admin
    if (userError && user) {
      console.log('Error loading user data, showing full menu as fallback');
      return [
        { id: 'dashboard', label: 'Panel Principal', icon: BarChart3 },
        { id: 'patients', label: 'Pacientes', icon: Users },
        { id: 'appointments', label: 'Turnos', icon: Calendar },
        { id: 'medicos', label: 'Médicos', icon: UserCog },
        { id: 'obras-sociales', label: 'Obras Sociales', icon: Building2 },
        { id: 'nomenclador', label: 'Nomenclador', icon: BookOpen },
        { id: 'authorizations', label: 'Autorizaciones', icon: Shield },
        { id: 'credenciales', label: 'Credenciales', icon: CreditCard },
        { id: 'recetarios', label: 'Recetarios', icon: Pill },
        { id: 'facturacion', label: 'Facturación', icon: FileText },
        { id: 'reports', label: 'Reportes', icon: TrendingUp },
        { id: 'users', label: 'Usuarios', icon: UsersIcon },
        { id: 'audit-logs', label: 'Logs de Auditoría', icon: ClipboardList },
      ];
    }

    // Si no hay datos del usuario aún, mostrar solo el dashboard para admin/usuario_normal
    if (!currentUser) {
      return [{ id: 'dashboard', label: 'Panel Principal', icon: BarChart3 }];
    }

    // Secciones disponibles según el rol
    if (currentUser.role === 'admin') {
      return [
        { id: 'dashboard', label: 'Panel Principal', icon: BarChart3 },
        { id: 'patients', label: 'Pacientes', icon: Users },
        { id: 'appointments', label: 'Turnos', icon: Calendar },
        { id: 'medicos', label: 'Médicos', icon: UserCog },
        { id: 'obras-sociales', label: 'Obras Sociales', icon: Building2 },
        { id: 'nomenclador', label: 'Nomenclador', icon: BookOpen },
        { id: 'authorizations', label: 'Autorizaciones', icon: Shield },
        { id: 'credenciales', label: 'Credenciales', icon: CreditCard },
        { id: 'recetarios', label: 'Recetarios', icon: Pill },
        { id: 'facturacion', label: 'Facturación', icon: FileText },
        { id: 'reports', label: 'Reportes', icon: TrendingUp },
        { id: 'users', label: 'Usuarios', icon: UsersIcon },
        { id: 'audit-logs', label: 'Logs de Auditoría', icon: ClipboardList },
      ];
    } else if (currentUser.role === 'usuario_normal') {
      // Usuario normal: no puede ver usuarios ni logs de auditoría
      return [
        { id: 'dashboard', label: 'Panel Principal', icon: BarChart3 },
        { id: 'patients', label: 'Pacientes', icon: Users },
        { id: 'appointments', label: 'Turnos', icon: Calendar },
        { id: 'medicos', label: 'Médicos', icon: UserCog },
        { id: 'obras-sociales', label: 'Obras Sociales', icon: Building2 },
        { id: 'nomenclador', label: 'Nomenclador', icon: BookOpen },
        { id: 'authorizations', label: 'Autorizaciones', icon: Shield },
        { id: 'credenciales', label: 'Credenciales', icon: CreditCard },
        { id: 'recetarios', label: 'Recetarios', icon: Pill },
        { id: 'facturacion', label: 'Facturación', icon: FileText },
        { id: 'reports', label: 'Reportes', icon: TrendingUp },
      ];
    } else if (currentUser.role === 'prestador') {
      // Prestador: solo puede acceder a autorizaciones (SIN dashboard)
      return [
        { id: 'authorizations', label: 'Autorizaciones', icon: Shield },
      ];
    }

    return [{ id: 'dashboard', label: 'Panel Principal', icon: BarChart3 }];
  };

  const menuItems = getMenuItems();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className={cn(
      "bg-slate-900 text-white min-h-screen p-4 transition-all duration-300",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-700">
        <div className={cn("flex items-center gap-2", isCollapsed && "justify-center")}>
          {systemConfig?.logo_url ? (
            <img 
              src={systemConfig.logo_url} 
              alt="Logo" 
              className="h-8 w-8 object-contain flex-shrink-0"
            />
          ) : (
            <Activity className="h-8 w-8 text-blue-400 flex-shrink-0" />
          )}
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold">{systemConfig?.name || 'EMA SALUD'}</h1>
              <p className="text-sm text-slate-400">{systemConfig?.subtitle || 'Sistema de Gestión'}</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-white p-1"
        >
          <ChevronLeft className={cn("h-5 w-5 transition-transform", isCollapsed && "rotate-180")} />
        </Button>
      </div>
      
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left",
                activeSection === item.id
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>
      
      <div className={cn(
        "mt-8 pt-4 border-t border-slate-700",
        isCollapsed && "text-center"
      )}>
        {!isCollapsed && (
          <div className="text-sm text-slate-400 mb-4">
            {isLoadingUser ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cargando usuario...</span>
              </div>
            ) : currentUser ? (
              <>
                <p className="font-medium text-white">{currentUser.full_name}</p>
                <p>{currentUser.email}</p>
                <p className="capitalize">
                  {currentUser.role === 'admin' ? 'Administrador' : 
                   currentUser.role === 'usuario_normal' ? 'Usuario Normal' : 
                   'Prestador'}
                </p>
              </>
            ) : userError && user ? (
              <>
                <p className="font-medium text-white">{user.email}</p>
                <p className="text-yellow-400">Administrador</p>
                <p className="text-xs text-slate-500">Datos del perfil no disponibles</p>
              </>
            ) : user ? (
              <>
                <p className="font-medium text-white">{user.email}</p>
                <p className="text-yellow-400">Rol no disponible</p>
              </>
            ) : (
              <p className="text-slate-500">Usuario no autenticado</p>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full text-slate-300 hover:text-white hover:bg-slate-800",
            isCollapsed ? "justify-center p-3" : "justify-start"
          )}
          title={isCollapsed ? "Cerrar Sesión" : undefined}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="ml-2">Cerrar Sesión</span>}
        </Button>
        {!isCollapsed && (
          <p className="text-xs text-slate-500 text-center mt-3">v1.505-20-07</p>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
